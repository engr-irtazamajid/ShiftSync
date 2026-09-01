import { AvailabilityType, ConstraintRule } from "@shiftsync/shared";
import {
  localTimeOfDayInZone,
  localWindowExistsOnDate,
  toLocalDateString,
} from "../../time/tz";
import { ConstraintRuleFn, emptyResult } from "../types";

interface Window {
  startUtc: Date;
  endUtc: Date;
}

function windowsForDate(
  ctx: Parameters<ConstraintRuleFn>[0],
  dateISO: string,
  tz: string
): Window[] {
  const exception = ctx.availability.find(
    (a) => a.type === AvailabilityType.Exception && a.exceptionDate === dateISO
  );

  if (exception) {
    if (exception.isUnavailable) return [];
    if (!exception.exceptionStartLocalTime || !exception.exceptionEndLocalTime) return [];
    const w = localWindowExistsOnDate(
      dateISO,
      tz,
      exception.exceptionStartLocalTime,
      exception.exceptionEndLocalTime
    );
    return w ? [w] : [];
  }

  const windows: Window[] = [];
  for (const rec of ctx.availability) {
    if (rec.type !== AvailabilityType.Recurring) continue;
    if (rec.dayOfWeek === null || !rec.startLocalTime || !rec.endLocalTime) continue;
    const w = localWindowExistsOnDate(dateISO, tz, rec.startLocalTime, rec.endLocalTime);
    if (!w) continue;
    // localWindowExistsOnDate anchors the window's start to dateISO regardless of the
    // recurring rule's own dayOfWeek, so confirm dateISO actually is that weekday.
    const startLocal = localTimeOfDayInZone(w.startUtc, tz);
    if (startLocal.dayOfWeek === rec.dayOfWeek) windows.push(w);
  }
  return windows;
}

/**
 * The shift instant range [startUtc, endUtc) must be fully covered by the
 * union of that staff member's local-time availability windows spanning
 * every date the shift touches. A DST date on which a recurring window
 * cannot resolve to a real wall-clock window (spring-forward gap) yields no
 * window for that date rather than throwing — the staff member is simply
 * unavailable that date, per the documented DST policy.
 */
export const checkAvailability: ConstraintRuleFn = (ctx) => {
  const result = emptyResult();
  const tz = ctx.location.timezone;

  const startDate = toLocalDateString(ctx.shift.startUtc, tz);
  const endDate = toLocalDateString(ctx.shift.endUtc, tz);
  const datesToCheck = Array.from(new Set([startDate, endDate]));

  const allWindows = datesToCheck.flatMap((d) => windowsForDate(ctx, d, tz));

  const covered = isRangeCovered(
    ctx.shift.startUtc,
    ctx.shift.endUtc,
    allWindows
  );

  if (!covered) {
    result.violations.push({
      rule: ConstraintRule.OutsideAvailability,
      message: "Shift falls outside staff member's stated availability.",
      severity: "block",
      details: { dates: datesToCheck },
    });
  }

  return result;
};

/** True if [start,end) is fully covered by the union of (possibly overlapping) windows. */
function isRangeCovered(start: Date, end: Date, windows: Window[]): boolean {
  if (windows.length === 0) return start.getTime() >= end.getTime();

  const sorted = [...windows].sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
  let cursor = start.getTime();

  for (const w of sorted) {
    if (w.startUtc.getTime() > cursor) break;
    if (w.endUtc.getTime() > cursor) cursor = w.endUtc.getTime();
    if (cursor >= end.getTime()) return true;
  }

  return cursor >= end.getTime();
}
