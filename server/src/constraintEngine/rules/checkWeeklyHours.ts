import { ConstraintWarning } from "@shiftsync/shared";
import { ConstraintRuleFn, emptyResult } from "../types";

const WEEKLY_WARN_HOURS = 35;

/**
 * Weeks are compared by the stored weekKey (ISO week computed in each
 * shift's own location tz at creation) rather than recomputed here, so this
 * stays index-friendly and consistent with how shifts are queried elsewhere.
 */
export const checkWeeklyHours: ConstraintRuleFn = (ctx) => {
  const result = emptyResult();

  const candidateHours =
    (ctx.shift.endUtc.getTime() - ctx.shift.startUtc.getTime()) / (1000 * 60 * 60);

  let totalHours = candidateHours;
  for (const { shift } of ctx.activeAssignments) {
    if (shift.weekKey === ctx.shift.weekKey) {
      totalHours += (shift.endUtc.getTime() - shift.startUtc.getTime()) / (1000 * 60 * 60);
    }
  }

  if (totalHours >= WEEKLY_WARN_HOURS) {
    result.warnings.push({
      rule: ConstraintWarning.ApproachingWeekly40,
      message: `Total scheduled hours for week ${ctx.shift.weekKey} would reach ${totalHours.toFixed(2)}h.`,
      details: { weekKey: ctx.shift.weekKey, totalHours },
    });
  }

  return result;
};
