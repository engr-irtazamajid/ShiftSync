import mongoose, { Types } from "mongoose";
import {
  AssignmentStatus,
  AuditAction,
  AuditEntityType,
  NotificationType,
  OPEN_SWAP_STATUSES,
  Role,
  SwapStatus,
  SwapType,
} from "@shiftsync/shared";
import { evaluateAssignment } from "../../constraintEngine";
import { AssignmentModel } from "../../models/Assignment";
import { ShiftModel } from "../../models/Shift";
import { SwapRequestModel, SwapRequestDocument } from "../../models/SwapRequest";
import { CertificationModel } from "../../models/Certification";
import { UserModel } from "../../models/User";
import { AppError } from "../../middleware/AppError";
import { writeAuditLog } from "../audit/service";
import { createNotification } from "../notifications/service";
import { emitSwapCreated, emitSwapResolved } from "../../sockets/emitters";
import { sweepExpiredDrops } from "../../jobs/dropExpiry";
import { toSwapRequestDTO } from "./mapper";

const MAX_PENDING_PER_STAFF = 3;
const DROP_EXPIRY_HOURS_BEFORE_SHIFT = 24;

export interface CreateSwapInput {
  assignmentId: string;
  type: SwapType;
  targetStaffId?: string;
  requestedBy: string;
}

export async function createSwapRequest(input: CreateSwapInput): Promise<SwapRequestDocument> {
  const assignment = await AssignmentModel.findById(input.assignmentId);
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
  if (assignment.status !== AssignmentStatus.Active) {
    throw new AppError(409, "ASSIGNMENT_NOT_ACTIVE", "Assignment is not active");
  }
  if (assignment.staffId.toString() !== input.requestedBy) {
    throw new AppError(
      403,
      "NOT_ASSIGNMENT_OWNER",
      "You may only request a swap on your own assignment"
    );
  }

  const pendingCount = await SwapRequestModel.countDocuments({
    requestedBy: input.requestedBy,
    status: { $in: OPEN_SWAP_STATUSES },
  });
  if (pendingCount >= MAX_PENDING_PER_STAFF) {
    throw new AppError(
      409,
      "MAX_PENDING_SWAPS",
      "You already have the maximum number of pending swap/drop requests"
    );
  }

  if (input.type === SwapType.Swap && !input.targetStaffId) {
    throw new AppError(
      400,
      "TARGET_STAFF_REQUIRED",
      "targetStaffId is required for a swap request"
    );
  }

  const shift = await ShiftModel.findById(assignment.shiftId);
  if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");

  const expiresAt =
    input.type === SwapType.Drop
      ? new Date(shift.startUtc.getTime() - DROP_EXPIRY_HOURS_BEFORE_SHIFT * 60 * 60 * 1000)
      : null;

  const swap = await SwapRequestModel.create({
    type: input.type,
    assignmentId: assignment._id,
    requestedBy: input.requestedBy,
    targetStaffId: input.type === SwapType.Swap ? input.targetStaffId : null,
    claimedBy: null,
    status:
      input.type === SwapType.Swap ? SwapStatus.PendingTargetAcceptance : SwapStatus.PendingClaim,
    expiresAt,
  });

  await writeAuditLog({
    entityType: AuditEntityType.SwapRequest,
    entityId: swap._id,
    action: AuditAction.Create,
    performedBy: input.requestedBy,
    before: null,
    after: swap.toObject(),
    locationId: shift.locationId,
    session: undefined,
  });

  emitSwapCreated(shift.locationId.toString(), toSwapRequestDTO(swap));

  if (input.type === SwapType.Swap && input.targetStaffId) {
    await createNotification({
      userId: input.targetStaffId,
      type: NotificationType.SwapRequested,
      title: "Swap request received",
      body: "A coworker has requested to swap a shift with you.",
      relatedEntityType: AuditEntityType.SwapRequest,
      relatedEntityId: swap.id.toString(),
    });
  } else {
    await notifyEligibleClaimants(swap, shift.locationId.toString());
  }

  return swap;
}

async function notifyEligibleClaimants(
  swap: SwapRequestDocument,
  locationId: string
): Promise<void> {
  const certifiedStaffIds = await CertificationModel.find({ locationId, revokedAt: null }).distinct(
    "staffId"
  );
  for (const staffId of certifiedStaffIds) {
    if (staffId.toString() === swap.requestedBy.toString()) continue;
    await createNotification({
      userId: staffId.toString(),
      type: NotificationType.DropAvailable,
      title: "Shift drop available",
      body: "A shift has become available to claim.",
      relatedEntityType: AuditEntityType.SwapRequest,
      relatedEntityId: swap.id.toString(),
    });
  }
}

async function loadOpenSwap(swapId: string): Promise<SwapRequestDocument> {
  const swap = await SwapRequestModel.findById(swapId);
  if (!swap) throw new AppError(404, "SWAP_NOT_FOUND", "Swap request not found");
  return swap;
}

export async function acceptSwap(
  swapId: string,
  actingUserId: string
): Promise<SwapRequestDocument> {
  const swap = await loadOpenSwap(swapId);
  if (swap.type !== SwapType.Swap)
    throw new AppError(400, "NOT_A_SWAP", "Only swap requests can be accepted");
  if (swap.status !== SwapStatus.PendingTargetAcceptance) {
    throw new AppError(409, "INVALID_STATE", "Swap request is not awaiting target acceptance");
  }
  if (swap.targetStaffId?.toString() !== actingUserId) {
    throw new AppError(403, "NOT_TARGET", "Only the swap target may accept this request");
  }

  const before = swap.toObject();
  swap.status = SwapStatus.PendingManagerApproval;
  await swap.save();
  await auditSwap(swap, before, AuditAction.Update, actingUserId);

  await notifyManagersForSwap(
    swap,
    NotificationType.ApprovalNeeded,
    "Swap awaiting approval",
    "A swap request has been accepted and now needs manager approval."
  );

  return swap;
}

export async function rejectSwap(
  swapId: string,
  actingUserId: string
): Promise<SwapRequestDocument> {
  const swap = await loadOpenSwap(swapId);
  if (swap.type !== SwapType.Swap)
    throw new AppError(400, "NOT_A_SWAP", "Only swap requests can be rejected");
  if (swap.status !== SwapStatus.PendingTargetAcceptance) {
    throw new AppError(409, "INVALID_STATE", "Swap request is not awaiting target acceptance");
  }
  if (swap.targetStaffId?.toString() !== actingUserId) {
    throw new AppError(403, "NOT_TARGET", "Only the swap target may reject this request");
  }

  const before = swap.toObject();
  swap.status = SwapStatus.Denied;
  swap.managerDecisionReason = "Rejected by target staff member";
  await swap.save();
  await auditSwap(swap, before, AuditAction.Deny, actingUserId);

  await resolveNotify(swap, "denied");
  return swap;
}

export async function claimDrop(
  swapId: string,
  actingUserId: string
): Promise<SwapRequestDocument> {
  const swap = await loadOpenSwap(swapId);
  if (swap.type !== SwapType.Drop)
    throw new AppError(400, "NOT_A_DROP", "Only drop requests can be claimed");
  if (swap.status !== SwapStatus.PendingClaim) {
    throw new AppError(409, "INVALID_STATE", "Drop request is not awaiting a claim");
  }
  if (swap.expiresAt && swap.expiresAt.getTime() <= Date.now()) {
    swap.status = SwapStatus.Expired;
    await swap.save();
    await resolveNotify(swap, "expired");
    throw new AppError(409, "SWAP_EXPIRED", "This drop request has expired");
  }

  const assignment = await AssignmentModel.findById(swap.assignmentId);
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");

  const evaluation = await evaluateAssignment({
    staffId: actingUserId,
    shiftId: assignment.shiftId.toString(),
  });
  if (!evaluation.passed) {
    throw new AppError(422, "CONSTRAINT_VIOLATION", "You are not eligible to claim this shift", {
      result: evaluation as unknown as Record<string, unknown>,
    });
  }

  const before = swap.toObject();
  swap.claimedBy = new Types.ObjectId(actingUserId);
  swap.status = SwapStatus.PendingManagerApproval;
  await swap.save();
  await auditSwap(swap, before, AuditAction.Update, actingUserId);

  await notifyManagersForSwap(
    swap,
    NotificationType.ApprovalNeeded,
    "Drop claim awaiting approval",
    "A dropped shift has been claimed and now needs manager approval."
  );

  return swap;
}

export async function withdrawSwap(
  swapId: string,
  actingUserId: string
): Promise<SwapRequestDocument> {
  const swap = await loadOpenSwap(swapId);
  if (swap.requestedBy.toString() !== actingUserId) {
    throw new AppError(403, "NOT_REQUESTER", "Only the requester may withdraw this request");
  }
  if (
    !OPEN_SWAP_STATUSES.includes(swap.status) ||
    swap.status === SwapStatus.PendingManagerApproval
  ) {
    throw new AppError(409, "INVALID_STATE", "This request can no longer be withdrawn");
  }

  const before = swap.toObject();
  swap.status = SwapStatus.Withdrawn;
  await swap.save();
  await auditSwap(swap, before, AuditAction.Withdraw, actingUserId);

  await resolveNotify(swap, "withdrawn");
  return swap;
}

interface ApproveResult {
  swap: SwapRequestDocument;
  incomingStaffId: string;
}

/**
 * The original assignment stays untouched by every prior transition; only
 * here — the final manager-approve step — does the actual staff change take
 * effect, atomically with releasing the old assignment and creating the new
 * one, in one transaction.
 */
export async function approveSwap(
  swapId: string,
  managerId: string,
  managerLocationIds: string[],
  isAdmin: boolean
): Promise<ApproveResult> {
  const session = await mongoose.startSession();
  let resultSwap: SwapRequestDocument | null = null;
  let incomingStaffId = "";

  try {
    await session.withTransaction(async () => {
      const swap = await SwapRequestModel.findById(swapId).session(session);
      if (!swap) throw new AppError(404, "SWAP_NOT_FOUND", "Swap request not found");
      if (swap.status !== SwapStatus.PendingManagerApproval) {
        throw new AppError(409, "INVALID_STATE", "Swap request is not awaiting manager approval");
      }

      const originalAssignment = await AssignmentModel.findById(swap.assignmentId).session(session);
      if (!originalAssignment || originalAssignment.status !== AssignmentStatus.Active) {
        throw new AppError(409, "ASSIGNMENT_NOT_ACTIVE", "Original assignment is no longer active");
      }

      const shift = await ShiftModel.findById(originalAssignment.shiftId).session(session);
      if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");

      if (!isAdmin && !managerLocationIds.includes(shift.locationId.toString())) {
        throw new AppError(
          403,
          "OUT_OF_SCOPE",
          "This shift's location is outside your managed scope"
        );
      }

      const newStaffId =
        swap.type === SwapType.Swap ? swap.targetStaffId?.toString() : swap.claimedBy?.toString();
      if (!newStaffId)
        throw new AppError(
          400,
          "MISSING_NEW_STAFF",
          "Swap request has no resolved incoming staff member"
        );

      const evaluation = await evaluateAssignment({
        staffId: newStaffId,
        shiftId: shift.id.toString(),
        excludeAssignmentId: originalAssignment.id.toString(),
        session,
      });

      if (!evaluation.passed) {
        throw new AppError(
          422,
          "CONSTRAINT_VIOLATION",
          "Incoming staff member fails scheduling constraints",
          {
            result: evaluation as unknown as Record<string, unknown>,
          }
        );
      }

      const assignmentBefore = originalAssignment.toObject();
      originalAssignment.status = AssignmentStatus.Released;
      originalAssignment.releasedAt = new Date();
      originalAssignment.releasedReason = `Released via approved ${swap.type} (${swap.id.toString()})`;
      originalAssignment.version += 1;
      await originalAssignment.save({ session });

      await writeAuditLog({
        entityType: AuditEntityType.Assignment,
        entityId: originalAssignment._id,
        action: AuditAction.Cancel,
        performedBy: managerId,
        before: assignmentBefore,
        after: originalAssignment.toObject(),
        locationId: shift.locationId,
        session,
      });

      const [newAssignment] = await AssignmentModel.create(
        [
          {
            shiftId: shift._id,
            staffId: newStaffId,
            status: AssignmentStatus.Active,
            version: 0,
            assignedBy: managerId,
            assignedAt: new Date(),
          },
        ],
        { session }
      );

      await writeAuditLog({
        entityType: AuditEntityType.Assignment,
        entityId: newAssignment._id,
        action: AuditAction.Create,
        performedBy: managerId,
        before: null,
        after: newAssignment.toObject(),
        locationId: shift.locationId,
        session,
      });

      const swapBefore = swap.toObject();
      swap.status = SwapStatus.Approved;
      swap.managerDecisionBy = new Types.ObjectId(managerId);
      swap.managerDecisionAt = new Date();
      await swap.save({ session });

      await writeAuditLog({
        entityType: AuditEntityType.SwapRequest,
        entityId: swap._id,
        action: AuditAction.Approve,
        performedBy: managerId,
        before: swapBefore,
        after: swap.toObject(),
        locationId: shift.locationId,
        session,
      });

      resultSwap = swap;
      incomingStaffId = newStaffId;
    });
  } finally {
    await session.endSession();
  }

  if (!resultSwap) throw new AppError(500, "APPROVE_FAILED", "Failed to approve swap request");

  await resolveNotify(resultSwap, "approved");
  return { swap: resultSwap, incomingStaffId };
}

export async function denySwap(
  swapId: string,
  managerId: string,
  managerLocationIds: string[],
  isAdmin: boolean,
  reason: string
): Promise<SwapRequestDocument> {
  const swap = await loadOpenSwap(swapId);
  if (swap.status !== SwapStatus.PendingManagerApproval) {
    throw new AppError(409, "INVALID_STATE", "Swap request is not awaiting manager approval");
  }

  const assignment = await AssignmentModel.findById(swap.assignmentId);
  if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
  const shift = await ShiftModel.findById(assignment.shiftId);
  if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");

  if (!isAdmin && !managerLocationIds.includes(shift.locationId.toString())) {
    throw new AppError(403, "OUT_OF_SCOPE", "This shift's location is outside your managed scope");
  }

  const before = swap.toObject();
  swap.status = SwapStatus.Denied;
  swap.managerDecisionBy = new Types.ObjectId(managerId);
  swap.managerDecisionAt = new Date();
  swap.managerDecisionReason = reason;
  await swap.save();
  await auditSwap(swap, before, AuditAction.Deny, managerId, shift.locationId);

  await resolveNotify(swap, "denied");
  return swap;
}

export interface ListSwapsFilter {
  status?: SwapStatus;
  type?: SwapType;
  requestedBy?: string;
  targetStaffId?: string;
}

export async function listSwaps(filter: ListSwapsFilter): Promise<SwapRequestDocument[]> {
  await sweepExpiredDrops();
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.type) query.type = filter.type;
  if (filter.requestedBy) query.requestedBy = filter.requestedBy;
  if (filter.targetStaffId) query.targetStaffId = filter.targetStaffId;
  return SwapRequestModel.find(query).sort({ createdAt: -1 });
}

async function auditSwap(
  swap: SwapRequestDocument,
  before: unknown,
  action: AuditAction,
  performedBy: string,
  locationIdOverride?: Types.ObjectId
): Promise<void> {
  let locationId = locationIdOverride;
  if (!locationId) {
    const assignment = await AssignmentModel.findById(swap.assignmentId);
    const shift = assignment ? await ShiftModel.findById(assignment.shiftId) : null;
    locationId = shift?.locationId;
  }
  if (!locationId) return;

  await writeAuditLog({
    entityType: AuditEntityType.SwapRequest,
    entityId: swap._id,
    action,
    performedBy,
    before,
    after: swap.toObject(),
    locationId,
    session: undefined,
  });
}

async function notifyManagersForSwap(
  swap: SwapRequestDocument,
  type: NotificationType,
  title: string,
  body: string
): Promise<void> {
  const assignment = await AssignmentModel.findById(swap.assignmentId);
  if (!assignment) return;
  const shift = await ShiftModel.findById(assignment.shiftId);
  if (!shift) return;

  const managers = await UserModel.find({
    role: Role.Manager,
    managedLocationIds: shift.locationId,
  });
  const admins = await UserModel.find({ role: Role.Admin });

  for (const recipient of [...managers, ...admins]) {
    await createNotification({
      userId: recipient.id.toString(),
      type,
      title,
      body,
      relatedEntityType: AuditEntityType.SwapRequest,
      relatedEntityId: swap.id.toString(),
    });
  }
}

export async function resolveNotify(
  swap: SwapRequestDocument,
  resolution: "approved" | "denied" | "auto_cancelled" | "expired" | "withdrawn"
): Promise<void> {
  const recipients = new Set<string>([swap.requestedBy.toString()]);
  if (swap.targetStaffId) recipients.add(swap.targetStaffId.toString());
  if (swap.claimedBy) recipients.add(swap.claimedBy.toString());

  emitSwapResolved(Array.from(recipients), { swapRequest: toSwapRequestDTO(swap), resolution });

  for (const userId of recipients) {
    await createNotification({
      userId,
      type: NotificationType.SwapResolved,
      title: "Swap request resolved",
      body: `Your swap/drop request was ${resolution.replace("_", " ")}.`,
      relatedEntityType: AuditEntityType.SwapRequest,
      relatedEntityId: swap.id.toString(),
    });
  }
}
