import mongoose, { Types } from "mongoose";
import {
  AssignmentStatus,
  AuditAction,
  AuditEntityType,
  NotificationType,
  ShiftStatus,
  SwapStatus,
  OPEN_SWAP_STATUSES,
} from "@shiftsync/shared";
import { computeWeekKey } from "../../time/tz";
import { ShiftModel, ShiftDocument, computeIsPremium } from "../../models/Shift";
import { AssignmentModel } from "../../models/Assignment";
import { LocationModel } from "../../models/Location";
import { SwapRequestModel, SwapRequestDocument } from "../../models/SwapRequest";
import { AuditLogModel } from "../../models/AuditLog";
import { AppError } from "../../middleware/AppError";
import { env } from "../../config/env";
import { writeAuditLog } from "../audit/service";
import { createNotification, emitCreatedNotification } from "../notifications/service";
import { NotificationDocument } from "../../models/Notification";
import {
  emitSchedulePublished,
  emitScheduleUnpublished,
  emitShiftUpdated,
} from "../../sockets/emitters";
import { resolveNotify } from "../swaps/service";
import { toShiftDTO } from "./mapper";

export interface CreateShiftInput {
  locationId: string;
  requiredSkillId: string;
  startUtc: string;
  endUtc: string;
  headcount: number;
  notes?: string | null;
  createdBy: string;
}

export async function createShift(input: CreateShiftInput): Promise<ShiftDocument> {
  const location = await LocationModel.findById(input.locationId);
  if (!location) throw new AppError(404, "LOCATION_NOT_FOUND", "Location not found");

  const startUtc = new Date(input.startUtc);
  const endUtc = new Date(input.endUtc);
  if (endUtc.getTime() <= startUtc.getTime()) {
    throw new AppError(400, "INVALID_RANGE", "endUtc must be after startUtc");
  }

  const weekKey = computeWeekKey(startUtc, location.timezone);
  const isPremium = computeIsPremium(startUtc, location.timezone);

  const shift = await ShiftModel.create({
    locationId: input.locationId,
    requiredSkillId: input.requiredSkillId,
    startUtc,
    endUtc,
    headcount: input.headcount,
    notes: input.notes ?? null,
    status: ShiftStatus.Draft,
    weekKey,
    isPremium,
    version: 0,
    createdBy: input.createdBy,
    updatedBy: input.createdBy,
  });

  await writeAuditLog({
    entityType: AuditEntityType.Shift,
    entityId: shift._id,
    action: AuditAction.Create,
    performedBy: input.createdBy,
    before: null,
    after: shift.toObject(),
    locationId: shift.locationId,
    session: undefined,
  });

  return shift;
}

export interface ListShiftsFilter {
  locationId?: string;
  weekKey?: string;
  status?: ShiftStatus;
  ids?: string[];
}

export async function listShifts(filter: ListShiftsFilter): Promise<ShiftDocument[]> {
  const query: Record<string, unknown> = {};
  if (filter.ids && filter.ids.length > 0) {
    query._id = { $in: filter.ids };
  } else {
    if (filter.locationId) query.locationId = filter.locationId;
    if (filter.weekKey) query.weekKey = filter.weekKey;
    if (filter.status) query.status = filter.status;
  }
  return ShiftModel.find(query).sort({ startUtc: 1 });
}

export async function getShift(id: string): Promise<ShiftDocument> {
  const shift = await ShiftModel.findById(id);
  if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");
  return shift;
}

export function assertLocationInScope(
  locationId: Types.ObjectId,
  managerLocationIds: string[],
  isAdmin: boolean
): void {
  if (isAdmin) return;
  if (!managerLocationIds.includes(locationId.toString())) {
    throw new AppError(403, "OUT_OF_SCOPE", "This location is outside your managed scope");
  }
}

function assertEditableCutoff(shift: ShiftDocument, isAdmin: boolean): void {
  if (isAdmin) return;
  const hoursUntilStart = (shift.startUtc.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilStart < env.shiftEditCutoffHours) {
    throw new AppError(
      409,
      "EDIT_CUTOFF_EXCEEDED",
      `Shifts starting within ${env.shiftEditCutoffHours}h cannot be edited by non-admins`
    );
  }
}

export interface UpdateShiftInput {
  startUtc?: string;
  endUtc?: string;
  headcount?: number;
  notes?: string | null;
  requiredSkillId?: string;
}

/**
 * Auto-cancels any pending SwapRequests tied to assignments on this shift in
 * the same transaction as the edit, per the state-machine invariant that a
 * manager edit invalidates in-flight swaps atomically with the edit itself.
 */
export async function updateShift(
  shiftId: string,
  input: UpdateShiftInput,
  actingUserId: string,
  isAdmin: boolean,
  managerLocationIds: string[]
): Promise<ShiftDocument> {
  const session = await mongoose.startSession();
  let updated: ShiftDocument | null = null;
  const cancelledSwaps: SwapRequestDocument[] = [];
  let createdNotifications: (NotificationDocument | null)[] = [];
  let affectedStaffIds: string[] = [];

  try {
    await session.withTransaction(async () => {
      const shift = await ShiftModel.findById(shiftId).session(session);
      if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");

      assertLocationInScope(shift.locationId, managerLocationIds, isAdmin);
      assertEditableCutoff(shift, isAdmin);

      const before = shift.toObject();
      const location = await LocationModel.findById(shift.locationId).session(session);
      if (!location) throw new AppError(404, "LOCATION_NOT_FOUND", "Location not found");

      if (input.startUtc) shift.startUtc = new Date(input.startUtc);
      if (input.endUtc) shift.endUtc = new Date(input.endUtc);
      if (shift.endUtc.getTime() <= shift.startUtc.getTime()) {
        throw new AppError(400, "INVALID_RANGE", "endUtc must be after startUtc");
      }
      if (input.headcount !== undefined) shift.headcount = input.headcount;
      if (input.notes !== undefined) shift.notes = input.notes;
      if (input.requiredSkillId) shift.requiredSkillId = new Types.ObjectId(input.requiredSkillId);

      if (input.startUtc) {
        shift.weekKey = computeWeekKey(shift.startUtc, location.timezone);
        shift.isPremium = computeIsPremium(shift.startUtc, location.timezone);
      }
      shift.updatedBy = new Types.ObjectId(actingUserId);

      await shift.save({ session });

      const activeAssignments = await AssignmentModel.find({
        shiftId: shift._id,
        status: AssignmentStatus.Active,
      }).session(session);
      const assignmentIds = activeAssignments.map((a) => a._id);
      affectedStaffIds = activeAssignments.map((a) => a.staffId.toString());

      const openSwaps = await SwapRequestModel.find({
        assignmentId: { $in: assignmentIds },
        status: { $in: OPEN_SWAP_STATUSES },
      }).session(session);

      for (const swap of openSwaps) {
        const swapBefore = swap.toObject();
        swap.status = SwapStatus.AutoCancelled;
        swap.autoCancelledReason = "Shift was edited by a manager while this swap was pending";
        await swap.save({ session });
        cancelledSwaps.push(swap);

        await writeAuditLog({
          entityType: AuditEntityType.SwapRequest,
          entityId: swap._id,
          action: AuditAction.AutoCancel,
          performedBy: actingUserId,
          before: swapBefore,
          after: swap.toObject(),
          locationId: shift.locationId,
          session,
        });
      }

      await writeAuditLog({
        entityType: AuditEntityType.Shift,
        entityId: shift._id,
        action: AuditAction.Update,
        performedBy: actingUserId,
        before,
        after: shift.toObject(),
        locationId: shift.locationId,
        session,
      });

      createdNotifications = await Promise.all(
        affectedStaffIds.map((staffId) =>
          createNotification({
            userId: staffId,
            type: NotificationType.ShiftChanged,
            title: "Shift changed",
            body: "A shift you're assigned to has been updated by a manager.",
            relatedEntityType: AuditEntityType.Shift,
            relatedEntityId: shift.id.toString(),
            session,
          })
        )
      );

      updated = shift;
    });
  } finally {
    await session.endSession();
  }

  if (!updated) throw new AppError(500, "UPDATE_FAILED", "Failed to update shift");

  const finalShift: ShiftDocument = updated;
  emitShiftUpdated(finalShift.locationId.toString(), { shift: toShiftDTO(finalShift) });
  createdNotifications.forEach(emitCreatedNotification);
  for (const swap of cancelledSwaps) {
    await resolveNotify(swap, "auto_cancelled");
  }

  return finalShift;
}

export async function cancelShift(
  shiftId: string,
  actingUserId: string,
  isAdmin: boolean,
  managerLocationIds: string[]
): Promise<ShiftDocument> {
  const session = await mongoose.startSession();
  let cancelled: ShiftDocument | null = null;
  const cancelledSwaps: SwapRequestDocument[] = [];
  let createdNotifications: (NotificationDocument | null)[] = [];

  try {
    await session.withTransaction(async () => {
      const shift = await ShiftModel.findById(shiftId).session(session);
      if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");

      assertLocationInScope(shift.locationId, managerLocationIds, isAdmin);
      assertEditableCutoff(shift, isAdmin);

      const before = shift.toObject();
      shift.status = ShiftStatus.Cancelled;
      shift.updatedBy = new Types.ObjectId(actingUserId);
      await shift.save({ session });

      const activeAssignments = await AssignmentModel.find({
        shiftId: shift._id,
        status: AssignmentStatus.Active,
      }).session(session);

      for (const assignment of activeAssignments) {
        assignment.status = AssignmentStatus.Cancelled;
        assignment.releasedAt = new Date();
        assignment.releasedReason = "Shift was cancelled";
        await assignment.save({ session });
      }

      const assignmentIds = activeAssignments.map((a) => a._id);
      const openSwaps = await SwapRequestModel.find({
        assignmentId: { $in: assignmentIds },
        status: { $in: OPEN_SWAP_STATUSES },
      }).session(session);

      for (const swap of openSwaps) {
        const swapBefore = swap.toObject();
        swap.status = SwapStatus.AutoCancelled;
        swap.autoCancelledReason = "Shift was cancelled by a manager while this swap was pending";
        await swap.save({ session });
        cancelledSwaps.push(swap);
        await writeAuditLog({
          entityType: AuditEntityType.SwapRequest,
          entityId: swap._id,
          action: AuditAction.AutoCancel,
          performedBy: actingUserId,
          before: swapBefore,
          after: swap.toObject(),
          locationId: shift.locationId,
          session,
        });
      }

      await writeAuditLog({
        entityType: AuditEntityType.Shift,
        entityId: shift._id,
        action: AuditAction.Cancel,
        performedBy: actingUserId,
        before,
        after: shift.toObject(),
        locationId: shift.locationId,
        session,
      });

      createdNotifications = await Promise.all(
        activeAssignments.map((assignment) =>
          createNotification({
            userId: assignment.staffId.toString(),
            type: NotificationType.ShiftChanged,
            title: "Shift cancelled",
            body: "A shift you were assigned to has been cancelled by a manager.",
            relatedEntityType: AuditEntityType.Shift,
            relatedEntityId: shift.id.toString(),
            session,
          })
        )
      );

      cancelled = shift;
    });
  } finally {
    await session.endSession();
  }

  if (!cancelled) throw new AppError(500, "CANCEL_FAILED", "Failed to cancel shift");

  const finalShift: ShiftDocument = cancelled;
  emitShiftUpdated(finalShift.locationId.toString(), { shift: toShiftDTO(finalShift) });
  createdNotifications.forEach(emitCreatedNotification);
  for (const swap of cancelledSwaps) {
    await resolveNotify(swap, "auto_cancelled");
  }

  return finalShift;
}

async function affectedStaffIdsForShifts(
  shiftIds: Types.ObjectId[],
  session: mongoose.ClientSession
): Promise<string[]> {
  const assignments = await AssignmentModel.find({
    shiftId: { $in: shiftIds },
    status: AssignmentStatus.Active,
  })
    .session(session)
    .distinct("staffId");
  return assignments.map((id) => id.toString());
}

export async function publishShifts(
  locationId: string,
  weekKey: string,
  actingUserId: string
): Promise<string[]> {
  const session = await mongoose.startSession();
  let shiftIds: Types.ObjectId[] = [];
  let createdNotifications: (NotificationDocument | null)[] = [];

  try {
    await session.withTransaction(async () => {
      const shifts = await ShiftModel.find({
        locationId,
        weekKey,
        status: ShiftStatus.Draft,
      }).session(session);
      shiftIds = shifts.map((s) => s._id);

      if (shiftIds.length > 0) {
        await ShiftModel.updateMany(
          { _id: { $in: shiftIds } },
          { $set: { status: ShiftStatus.Published, updatedBy: actingUserId } }
        ).session(session);
      }

      for (const shift of shifts) {
        await writeAuditLog({
          entityType: AuditEntityType.Shift,
          entityId: shift._id,
          action: AuditAction.Publish,
          performedBy: actingUserId,
          before: { status: ShiftStatus.Draft },
          after: { status: ShiftStatus.Published },
          locationId: shift.locationId,
          session,
        });
      }

      const staffIds = await affectedStaffIdsForShifts(shiftIds, session);
      createdNotifications = await Promise.all(
        staffIds.map((staffId) =>
          createNotification({
            userId: staffId,
            type: NotificationType.SchedulePublished,
            title: "Schedule published",
            body: `The schedule for week ${weekKey} has been published.`,
            relatedEntityType: AuditEntityType.Shift,
            session,
          })
        )
      );
    });
  } finally {
    await session.endSession();
  }

  emitSchedulePublished({ locationId, weekKey, shiftIds: shiftIds.map((id) => id.toString()) });
  emitShiftUpdated(locationId, { shift: null });
  createdNotifications.forEach(emitCreatedNotification);

  return shiftIds.map((id) => id.toString());
}

export async function unpublishShifts(
  locationId: string,
  weekKey: string,
  actingUserId: string
): Promise<string[]> {
  const session = await mongoose.startSession();
  let shiftIds: Types.ObjectId[] = [];
  let createdNotifications: (NotificationDocument | null)[] = [];

  try {
    await session.withTransaction(async () => {
      const shifts = await ShiftModel.find({
        locationId,
        weekKey,
        status: ShiftStatus.Published,
      }).session(session);
      shiftIds = shifts.map((s) => s._id);

      if (shiftIds.length > 0) {
        await ShiftModel.updateMany(
          { _id: { $in: shiftIds } },
          { $set: { status: ShiftStatus.Draft, updatedBy: actingUserId } }
        ).session(session);
      }

      for (const shift of shifts) {
        await writeAuditLog({
          entityType: AuditEntityType.Shift,
          entityId: shift._id,
          action: AuditAction.Unpublish,
          performedBy: actingUserId,
          before: { status: ShiftStatus.Published },
          after: { status: ShiftStatus.Draft },
          locationId: shift.locationId,
          session,
        });
      }

      const staffIds = await affectedStaffIdsForShifts(shiftIds, session);
      createdNotifications = await Promise.all(
        staffIds.map((staffId) =>
          createNotification({
            userId: staffId,
            type: NotificationType.ShiftChanged,
            title: "Schedule unpublished",
            body: `The schedule for week ${weekKey} was unpublished and is no longer visible.`,
            relatedEntityType: AuditEntityType.Shift,
            session,
          })
        )
      );
    });
  } finally {
    await session.endSession();
  }

  emitScheduleUnpublished({ locationId, weekKey });
  emitShiftUpdated(locationId, { shift: null });
  createdNotifications.forEach(emitCreatedNotification);

  return shiftIds.map((id) => id.toString());
}

export async function getShiftHistory(
  shiftId: string,
  isAdmin: boolean,
  managerLocationIds: string[]
) {
  const shift = await ShiftModel.findById(shiftId);
  if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");
  assertLocationInScope(shift.locationId, managerLocationIds, isAdmin);

  return AuditLogModel.find({ entityType: AuditEntityType.Shift, entityId: shiftId }).sort({
    timestamp: -1,
  });
}

export async function notifyAssignmentAffectedParties(
  staffId: string,
  shift: ShiftDocument,
  type: NotificationType,
  title: string,
  body: string
): Promise<void> {
  await createNotification({
    userId: staffId,
    type,
    title,
    body,
    relatedEntityType: AuditEntityType.Shift,
    relatedEntityId: shift.id.toString(),
  });
}
