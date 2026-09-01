import { DateTime } from "luxon";
import { ConstraintRule, ConstraintWarning } from "@shiftsync/shared";
import { toLocalDateString } from "../../time/tz";
import { ConstraintRuleFn, emptyResult } from "../types";

/**
 * A day counts as "worked" if any active assignment's shift overlaps that
 * calendar day at all, in that shift's own location tz — an overnight shift
 * counts both days it touches. The candidate shift is folded into the same
 * worked-day set before measuring the longest consecutive run that includes
 * the candidate's date(s).
 */
function workedDatesFor(
  shift: { startUtc: Date; endUtc: Date; locationId: { toString(): string } },
  tz: string
): string[] {
  const startDate = toLocalDateString(shift.startUtc, tz);
  const endDate = toLocalDateString(shift.endUtc, tz);
  return startDate === endDate ? [startDate] : [startDate, endDate];
}

export const checkConsecutiveDays: ConstraintRuleFn = (ctx) => {
  const result = emptyResult();

  const workedDates = new Set<string>();
  for (const { shift } of ctx.activeAssignments) {
    const shiftTz = ctx.locationsById.get(shift.locationId.toString())?.timezone ?? ctx.location.timezone;
    for (const d of workedDatesFor(shift, shiftTz)) workedDates.add(d);
  }
  for (const d of workedDatesFor(ctx.shift, ctx.location.timezone)) workedDates.add(d);

  const sortedDates = Array.from(workedDates)
    .map((d) => DateTime.fromISO(d, { zone: "utc" }))
    .sort((a, b) => a.toMillis() - b.toMillis());

  let longestRun = 1;
  let currentRun = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diffDays = sortedDates[i].diff(sortedDates[i - 1], "days").days;
    if (diffDays === 1) {
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 1;
    }
  }

  if (sortedDates.length === 0) return result;
  if (longestRun >= 7) {
    if (ctx.allowManagerOverride && ctx.overrideReason && ctx.overrideReason.trim().length > 0) {
      result.warnings.push({
        rule: ConstraintWarning.SixthConsecutiveDay,
        message: `${longestRun}th consecutive day worked, approved via manager override: ${ctx.overrideReason}`,
        details: { consecutiveDays: longestRun, overrideReason: ctx.overrideReason },
      });
    } else {
      result.violations.push({
        rule: ConstraintRule.SeventhConsecutiveDay,
        message: `This assignment would result in ${longestRun} consecutive days worked, exceeding the 6-day limit without manager override.`,
        severity: "block",
        details: { consecutiveDays: longestRun },
      });
    }
  } else if (longestRun === 6) {
    result.warnings.push({
      rule: ConstraintWarning.SixthConsecutiveDay,
      message: "This would be the 6th consecutive day worked.",
      details: { consecutiveDays: longestRun },
    });
  }

  return result;
};
