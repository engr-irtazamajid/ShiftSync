import { Types } from "mongoose";
import { ConstraintViolation, ConstraintWarningEntry } from "@shiftsync/shared";
import { AssignmentDocument } from "../models/Assignment";
import { AvailabilityDocument } from "../models/Availability";
import { CertificationDocument } from "../models/Certification";
import { LocationDocument } from "../models/Location";
import { ShiftDocument } from "../models/Shift";
import { UserDocument } from "../models/User";

export interface AssignmentWithShift {
  assignment: AssignmentDocument;
  shift: ShiftDocument;
}

/**
 * Fully preloaded state needed by every rule, gathered once per
 * evaluateAssignment call to avoid N+1 queries across the 8 rules.
 */
export interface EvaluationContext {
  staff: UserDocument;
  shift: ShiftDocument;
  location: LocationDocument;
  /** the staff's other active assignments (with their shifts), excluding excludeAssignmentId */
  activeAssignments: AssignmentWithShift[];
  /** locationId (string) -> Location, covering ctx.location and every activeAssignments[].shift.locationId */
  locationsById: Map<string, LocationDocument>;
  certifications: CertificationDocument[];
  availability: AvailabilityDocument[];
  allowManagerOverride: boolean;
  overrideReason: string | null;
}

export interface RuleResult {
  violations: ConstraintViolation[];
  warnings: ConstraintWarningEntry[];
}

export type ConstraintRuleFn = (ctx: EvaluationContext) => RuleResult;

export function emptyResult(): RuleResult {
  return { violations: [], warnings: [] };
}

export type ObjectIdLike = Types.ObjectId | string;
