import mongoose, { Types } from "mongoose";
import {
  AssignmentPreviewResult,
  AssignmentStatus,
  AuditAction,
  AuditEntityType,
  ConstraintCheckResult,
  NotificationType,
  Role,
} from "@shiftsync/shared";
import { evaluateAssignment } from "../../constraintEngine";
import { AssignmentModel, AssignmentDocument } from "../../models/Assignment";
import { ShiftModel, ShiftDocument } from "../../models/Shift";
import { LocationModel } from "../../models/Location";
import { UserModel } from "../../models/User";
import { AppError } from "../../middleware/AppError";
import { writeAuditLog } from "../audit/service";
import { createNotification } from "../notifications/service";
import {
  emitAssignmentConflict,
  emitAssignmentCreated,
  emitAssignmentRemoved,
  emitShiftUpdated,
} from "../../sockets/emitters";
import { toShiftDTO } from "../shifts/mapper";
import { toAssignmentDTO } from "./mapper";

const BASE_HOURLY_RATE = 18;
const OT_MULTIPLIER = 1.5;
const OT_WEEKLY_THRESHOLD_HOURS = 40;

export interface AssignStaffInput {
  shiftId: string;
  staffId: string;
  expectedShiftVersion: number;
  requestedBy: string;
  isAdmin: boolean;
  managerLocationIds: string[];
  allowManagerOverride?: boolean;
  overrideReason?: string;
}

export interface AssignStaffResult {
  assignment: AssignmentDocument;
  shift: ShiftDocument;
}

export async function assignStaff(input: AssignStaffInput): Promise<AssignStaffResult> {
  const session = await mongoose.startSession();
  let assignment: AssignmentDocument | null = null;
  let shift: ShiftDocument | null = null;

  try {
    await session.withTransaction(async () => {
      const candidateShift = await ShiftModel.findOne({
        _id: input.shiftId,
        version: input.expectedShiftVersion,
      }).session(session);

      if (!candidateShift) {
        emitAssignmentConflict(input.requestedBy, {
          code: "SHIFT_VERSION_CONFLICT",
          shiftId: input.shiftId,
          currentShift: await currentShiftSnapshot(input.shiftId),
        });
        throw new AppError(409, "SHIFT_VERSION_CONFLICT", "Shift has been modified; refresh and retry");
      }

      if (!input.isAdmin && !input.managerLocationIds.includes(candidateShift.locationId.toString())) {
        throw new AppError(403, "OUT_OF_SCOPE", "This shift's location is outside your managed scope");
      }

      const activeCount = await AssignmentModel.countDocuments({
        shiftId: candidateShift._id,
        status: AssignmentStatus.Active,
      }).session(session);

      if (activeCount >= candidateShift.headcount) {
        emitAssignmentConflict(input.requestedBy, {
          code: "SHIFT_FULL",
          shiftId: input.shiftId,
          currentShift: toShiftDTO(candidateShift),
        });
        throw new AppError(409, "SHIFT_FULL", "This shift has no open headcount");
      }

      const allowOverride = input.isAdmin && Boolean(input.allowManagerOverride);
      const evaluation = await evaluateAssignment({
        staffId: input.staffId,
        shiftId: input.shiftId,
        session,
        allowManagerOverride: allowOverride,
        overrideReason: allowOverride ? input.overrideReason : undefined,
      });

      if (!evaluation.passed) {
        throw new ConstraintFailure(evaluation);
      }

      const [createdAssignment] = await AssignmentModel.create(
        [
          {
            shiftId: candidateShift._id,
            staffId: input.staffId,
            status: AssignmentStatus.Active,
            version: 0,
            assignedBy: input.requestedBy,
            assignedAt: new Date(),
          },
        ],
        { session }
      );

      const versionBump = await ShiftModel.updateOne(
        { _id: candidateShift._id, version: input.expectedShiftVersion },
        { $inc: { version: 1 } }
      ).session(session);

      if (versionBump.modifiedCount === 0) {
        emitAssignmentConflict(input.requestedBy, {
          code: "SHIFT_VERSION_CONFLICT",
          shiftId: input.shiftId,
          currentShift: await currentShiftSnapshot(input.shiftId),
        });
        throw new AppError(409, "SHIFT_VERSION_CONFLICT", "Shift has been modified; refresh and retry");
      }

      await writeAuditLog({
        entityType: AuditEntityType.Assignment,
        entityId: createdAssignment._id,
        action: AuditAction.Create,
        performedBy: input.requestedBy,
        before: null,
        after: createdAssignment.toObject(),
        locationId: candidateShift.locationId,
        session,
      });

      assignment = createdAssignment;
      candidateShift.version += 1;
      shift = candidateShift;
    });
  } catch (err) {
    if (err instanceof ConstraintFailure) {
      throw new AppError(422, "CONSTRAINT_VIOLATION", "Assignment violates one or more scheduling constraints", {
        result: err.result as unknown as Record<string, unknown>,
      });
    }
    throw err;
  } finally {
    await session.endSession();
  }

  if (!assignment || !shift) {
    throw new AppError(500, "ASSIGN_FAILED", "Failed to create assignment");
  }

  const finalShift: ShiftDocument = shift;
  const finalAssignment: AssignmentDocument = assignment;

  emitShiftUpdated(finalShift.locationId.toString(), { shift: toShiftDTO(finalShift) });
  emitAssignmentCreated(input.staffId, toAssignmentDTO(finalAssignment));

  await createNotification({
    userId: input.staffId,
    type: NotificationType.ShiftAssigned,
    title: "New shift assigned",
    body: `You have been assigned a shift starting ${finalShift.startUtc.toISOString()}.`,
    relatedEntityType: AuditEntityType.Shift,
    relatedEntityId: finalShift.id.toString(),
  });

  await notifyManagersIfPushedIntoOvertime(input.staffId, finalShift);

  return { assignment: finalAssignment, shift: finalShift };
}

async function notifyManagersIfPushedIntoOvertime(staffId: string, shift: ShiftDocument): Promise<void> {
  const existingHours = await weeklyHoursForStaff(staffId, shift.weekKey, shift.id.toString());
  const shiftHours = (shift.endUtc.getTime() - shift.startUtc.getTime()) / (1000 * 60 * 60);
  const projectedWeeklyHours = existingHours + shiftHours;
  const pushesIntoOvertime = projectedWeeklyHours > OT_WEEKLY_THRESHOLD_HOURS && existingHours <= OT_WEEKLY_THRESHOLD_HOURS;
  if (!pushesIntoOvertime) return;

  const staff = await UserModel.findById(staffId);
  const recipients = await UserModel.find({
    $or: [{ role: Role.Admin }, { role: Role.Manager, managedLocationIds: shift.locationId }],
  });

  for (const recipient of recipients) {
    await createNotification({
      userId: recipient.id.toString(),
      type: NotificationType.OvertimeWarning,
      title: "Overtime warning",
      body: `${staff ? `${staff.firstName} ${staff.lastName}` : "A staff member"} is now projected at ${projectedWeeklyHours.toFixed(1)}h this week, over the 40h threshold.`,
      relatedEntityType: AuditEntityType.Shift,
      relatedEntityId: shift.id.toString(),
    });
  }
}

class ConstraintFailure extends Error {
  constructor(readonly result: ConstraintCheckResult) {
    super("Constraint violation");
  }
}

async function currentShiftSnapshot(shiftId: string): Promise<unknown> {
  const shift = await ShiftModel.findById(shiftId);
  return shift ? toShiftDTO(shift) : null;
}

export async function unassignStaff(
  assignmentId: string,
  actingUserId: string,
  reason: string,
  isAdmin: boolean,
  managerLocationIds: string[]
): Promise<void> {
  const session = await mongoose.startSession();
  let releasedAssignment: AssignmentDocument | null = null;
  let shiftLocationId: Types.ObjectId | null = null;

  try {
    await session.withTransaction(async () => {
      const assignment = await AssignmentModel.findById(assignmentId).session(session);
      if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
      if (assignment.status !== AssignmentStatus.Active) {
        throw new AppError(409, "ASSIGNMENT_NOT_ACTIVE", "Assignment is not active");
      }

      const shift = await ShiftModel.findById(assignment.shiftId).session(session);
      if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");

      if (!isAdmin && !managerLocationIds.includes(shift.locationId.toString())) {
        throw new AppError(403, "OUT_OF_SCOPE", "This shift's location is outside your managed scope");
      }

      const before = assignment.toObject();
      assignment.status = AssignmentStatus.Released;
      assignment.releasedAt = new Date();
      assignment.releasedReason = reason;
      assignment.version += 1;
      await assignment.save({ session });

      await writeAuditLog({
        entityType: AuditEntityType.Assignment,
        entityId: assignment._id,
        action: AuditAction.Cancel,
        performedBy: actingUserId,
        before,
        after: assignment.toObject(),
        locationId: shift.locationId,
        session,
      });

      releasedAssignment = assignment;
      shiftLocationId = shift.locationId;
    });
  } finally {
    await session.endSession();
  }

  if (!releasedAssignment || !shiftLocationId) {
    throw new AppError(500, "UNASSIGN_FAILED", "Failed to release assignment");
  }

  const finalAssignment: AssignmentDocument = releasedAssignment;
  emitAssignmentRemoved(finalAssignment.staffId.toString(), toAssignmentDTO(finalAssignment));

  await createNotification({
    userId: finalAssignment.staffId.toString(),
    type: NotificationType.ShiftUnassigned,
    title: "Shift assignment removed",
    body: reason,
    relatedEntityType: AuditEntityType.Assignment,
    relatedEntityId: finalAssignment.id.toString(),
  });
}

export async function previewAssignment(
  staffId: string,
  shiftId: string
): Promise<AssignmentPreviewResult> {
  const shift = await ShiftModel.findById(shiftId);
  if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");

  const evaluation = await evaluateAssignment({ staffId, shiftId });

  const existingHours = await weeklyHoursForStaff(staffId, shift.weekKey, shiftId);
  const shiftHours = (shift.endUtc.getTime() - shift.startUtc.getTime()) / (1000 * 60 * 60);
  const projectedWeeklyHours = existingHours + shiftHours;

  const priorOtHours = Math.max(0, existingHours - OT_WEEKLY_THRESHOLD_HOURS);
  const projectedOtHours = Math.max(0, projectedWeeklyHours - OT_WEEKLY_THRESHOLD_HOURS);
  const newOtHours = Math.max(0, projectedOtHours - priorOtHours);

  const regularHoursAdded = shiftHours - newOtHours;
  const projectedWeeklyOvertimeCost =
    regularHoursAdded * BASE_HOURLY_RATE + newOtHours * BASE_HOURLY_RATE * OT_MULTIPLIER;

  return {
    ...evaluation,
    projectedWeeklyHours,
    projectedWeeklyOvertimeHours: projectedOtHours,
    projectedWeeklyOvertimeCost,
    pushesIntoOvertime: projectedWeeklyHours > OT_WEEKLY_THRESHOLD_HOURS && existingHours <= OT_WEEKLY_THRESHOLD_HOURS,
  };
}

export async function listAssignments(filter: {
  shiftId?: string;
  shiftIds?: string[];
  staffId?: string;
  ids?: string[];
}): Promise<AssignmentDocument[]> {
  const query: Record<string, unknown> = {};
  if (filter.ids && filter.ids.length > 0) {
    query._id = { $in: filter.ids };
  } else if (filter.shiftId) {
    query.shiftId = filter.shiftId;
  } else if (filter.shiftIds && filter.shiftIds.length > 0) {
    query.shiftId = { $in: filter.shiftIds };
  }
  if (filter.staffId) {
    query.staffId = filter.staffId;
  }
  return AssignmentModel.find(query).sort({ assignedAt: -1 });
}

async function weeklyHoursForStaff(staffId: string, weekKey: string, excludeShiftId?: string): Promise<number> {
  const assignments = await AssignmentModel.find({ staffId, status: AssignmentStatus.Active });
  const shiftIds = assignments
    .map((a) => a.shiftId)
    .filter((id) => id.toString() !== excludeShiftId);
  const shifts = await ShiftModel.find({ _id: { $in: shiftIds }, weekKey });
  return shifts.reduce(
    (sum, s) => sum + (s.endUtc.getTime() - s.startUtc.getTime()) / (1000 * 60 * 60),
    0
  );
}
