import { ConstraintRule } from "@shiftsync/shared";
import { diffInHours } from "../../time/tz";
import { ConstraintRuleFn, emptyResult } from "../types";

const MIN_REST_HOURS = 10;

/** Gap is measured between the new shift and each existing shift's nearer edge; exactly 10h passes. */
export const checkMinRest: ConstraintRuleFn = (ctx) => {
  const result = emptyResult();

  for (const { shift } of ctx.activeAssignments) {
    let gapHours: number;
    if (shift.endUtc.getTime() <= ctx.shift.startUtc.getTime()) {
      gapHours = diffInHours(shift.endUtc, ctx.shift.startUtc);
    } else if (ctx.shift.endUtc.getTime() <= shift.startUtc.getTime()) {
      gapHours = diffInHours(ctx.shift.endUtc, shift.startUtc);
    } else {
      continue; // overlapping shifts are caught by checkDoubleBooking
    }

    if (gapHours < MIN_REST_HOURS) {
      result.violations.push({
        rule: ConstraintRule.MinRest,
        message: `Only ${gapHours.toFixed(2)}h of rest before/after an adjacent shift; ${MIN_REST_HOURS}h minimum required.`,
        severity: "block",
        details: { adjacentShiftId: shift.id.toString(), gapHours },
      });
    }
  }

  return result;
};
