import { ConstraintRule, ConstraintWarning } from "@shiftsync/shared";
import { toLocalDateString } from "../../time/tz";
import { ConstraintRuleFn, emptyResult } from "../types";

const DAILY_WARN_HOURS = 8;
const DAILY_BLOCK_HOURS = 12;

/**
 * "Daily hours" for a calendar day = sum of durations of all shifts (existing
 * + the candidate) whose local start date, in the shift's own location tz,
 * equals that day. An overnight shift is attributed in full to its start date
 * only, consistent with duration accounting (consecutive-day counting, which
 * needs "touches this day at all", is handled separately in checkConsecutiveDays).
 */
export const checkDailyHours: ConstraintRuleFn = (ctx) => {
  const result = emptyResult();
  const tz = ctx.location.timezone;

  const candidateDate = toLocalDateString(ctx.shift.startUtc, tz);
  const candidateHours =
    (ctx.shift.endUtc.getTime() - ctx.shift.startUtc.getTime()) / (1000 * 60 * 60);

  let totalHours = candidateHours;
  for (const { shift } of ctx.activeAssignments) {
    const shiftTz = ctx.locationsById.get(shift.locationId.toString())?.timezone ?? tz;
    const date = toLocalDateString(shift.startUtc, shiftTz);
    if (date === candidateDate) {
      totalHours += (shift.endUtc.getTime() - shift.startUtc.getTime()) / (1000 * 60 * 60);
    }
  }

  if (totalHours > DAILY_BLOCK_HOURS) {
    result.violations.push({
      rule: ConstraintRule.DailyHoursHardBlock,
      message: `Assigning this shift would bring total hours on ${candidateDate} to ${totalHours.toFixed(2)}h, exceeding the ${DAILY_BLOCK_HOURS}h hard limit.`,
      severity: "block",
      details: { date: candidateDate, totalHours },
    });
  } else if (totalHours > DAILY_WARN_HOURS) {
    result.warnings.push({
      rule: ConstraintWarning.DailyOver8,
      message: `Total hours on ${candidateDate} would be ${totalHours.toFixed(2)}h, above the ${DAILY_WARN_HOURS}h soft threshold.`,
      details: { date: candidateDate, totalHours },
    });
  }

  return result;
};
