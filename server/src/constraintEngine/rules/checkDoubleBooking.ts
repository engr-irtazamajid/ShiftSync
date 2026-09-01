import { ConstraintRule } from "@shiftsync/shared";
import { rangesOverlap } from "../../time/tz";
import { ConstraintRuleFn, emptyResult } from "../types";

/** Scans across all of the staff's active assignments regardless of location. */
export const checkDoubleBooking: ConstraintRuleFn = (ctx) => {
  const result = emptyResult();

  const conflict = ctx.activeAssignments.find(({ shift }) =>
    rangesOverlap(ctx.shift.startUtc, ctx.shift.endUtc, shift.startUtc, shift.endUtc)
  );

  if (conflict) {
    result.violations.push({
      rule: ConstraintRule.DoubleBooking,
      message: "Staff member is already assigned to an overlapping shift.",
      severity: "block",
      details: {
        conflictingShiftId: conflict.shift.id.toString(),
        conflictingLocationId: conflict.shift.locationId.toString(),
      },
    });
  }

  return result;
};
