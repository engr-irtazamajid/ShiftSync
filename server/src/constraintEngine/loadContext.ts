import { ClientSession, Types } from "mongoose";
import { AssignmentStatus } from "@shiftsync/shared";
import { AssignmentModel } from "../models/Assignment";
import { AvailabilityModel } from "../models/Availability";
import { CertificationModel } from "../models/Certification";
import { LocationModel, LocationDocument } from "../models/Location";
import { ShiftModel, ShiftDocument } from "../models/Shift";
import { UserModel } from "../models/User";
import { AppError } from "../middleware/AppError";
import { AssignmentWithShift, EvaluationContext } from "./types";

export interface LoadContextInput {
  staffId: string;
  shiftId: string;
  excludeAssignmentId?: string;
  session?: ClientSession;
  allowManagerOverride?: boolean;
  overrideReason?: string;
}

export async function loadEvaluationContext(input: LoadContextInput): Promise<EvaluationContext> {
  const { staffId, shiftId, excludeAssignmentId, session } = input;

  const [staff, shift] = await Promise.all([
    UserModel.findById(staffId).session(session ?? null),
    ShiftModel.findById(shiftId).session(session ?? null),
  ]);

  if (!staff) throw new AppError(404, "STAFF_NOT_FOUND", "Staff member not found");
  if (!shift) throw new AppError(404, "SHIFT_NOT_FOUND", "Shift not found");

  const location = await LocationModel.findById(shift.locationId).session(session ?? null);
  if (!location) throw new AppError(404, "LOCATION_NOT_FOUND", "Location not found");

  const activeAssignmentDocs = await AssignmentModel.find({
    staffId: staff._id,
    status: AssignmentStatus.Active,
    ...(excludeAssignmentId ? { _id: { $ne: new Types.ObjectId(excludeAssignmentId) } } : {}),
  }).session(session ?? null);

  const shiftDocs = await ShiftModel.find({
    _id: { $in: activeAssignmentDocs.map((a) => a.shiftId) },
  }).session(session ?? null);
  const shiftsById = new Map(shiftDocs.map((s) => [s.id.toString(), s]));

  const activeAssignments: AssignmentWithShift[] = activeAssignmentDocs
    .map((assignment) => {
      const s = shiftsById.get(assignment.shiftId.toString());
      return s ? { assignment, shift: s } : null;
    })
    .filter((x): x is AssignmentWithShift => x !== null);

  const locationIds = Array.from(
    new Set([shift.locationId.toString(), ...activeAssignments.map((a) => a.shift.locationId.toString())])
  );
  const locationDocs = await LocationModel.find({ _id: { $in: locationIds } }).session(session ?? null);
  const locationsById = new Map<string, LocationDocument>(locationDocs.map((l) => [l.id.toString(), l]));
  locationsById.set(location.id.toString(), location);

  const [certifications, availability] = await Promise.all([
    CertificationModel.find({ staffId: staff._id }).session(session ?? null),
    AvailabilityModel.find({ staffId: staff._id }).session(session ?? null),
  ]);

  return {
    staff,
    shift,
    location,
    activeAssignments,
    locationsById,
    certifications,
    availability,
    allowManagerOverride: input.allowManagerOverride ?? false,
    overrideReason: input.overrideReason ?? null,
  };
}

export type { ShiftDocument };
