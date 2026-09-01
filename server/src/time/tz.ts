import { DateTime } from "luxon";

export interface LocalTimeOfDay {
  hour: number;
  minute: number;
  dayOfWeek: number;
}

export function toLocationLocal(utcDate: Date, ianaTz: string): DateTime {
  return DateTime.fromJSDate(utcDate, { zone: "utc" }).setZone(ianaTz);
}

export function fromLocationLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  ianaTz: string
): Date {
  const dt = DateTime.fromObject(
    { year, month, day, hour, minute },
    { zone: ianaTz }
  );
  if (!dt.isValid) {
    throw new Error(`Invalid local time in zone ${ianaTz}: ${dt.invalidReason}`);
  }
  return dt.toUTC().toJSDate();
}

export function localTimeOfDayInZone(utcDate: Date, ianaTz: string): LocalTimeOfDay {
  const local = toLocationLocal(utcDate, ianaTz);
  return {
    hour: local.hour,
    minute: local.minute,
    dayOfWeek: local.weekday % 7,
  };
}

function parseHHmm(value: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = value.split(":");
  return { hour: Number(hourStr), minute: Number(minuteStr) };
}

export function isWithinLocalWindow(
  utcDate: Date,
  ianaTz: string,
  dayOfWeek: number,
  startHHmm: string,
  endHHmm: string
): boolean {
  const local = localTimeOfDayInZone(utcDate, ianaTz);
  if (local.dayOfWeek !== dayOfWeek) return false;

  const start = parseHHmm(startHHmm);
  const end = parseHHmm(endHHmm);
  const localMinutes = local.hour * 60 + local.minute;
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  if (endMinutes <= startMinutes) {
    return localMinutes >= startMinutes || localMinutes < endMinutes;
  }
  return localMinutes >= startMinutes && localMinutes < endMinutes;
}

export function computeWeekKey(utcDate: Date, ianaTz: string): string {
  const local = toLocationLocal(utcDate, ianaTz);
  return `${local.weekYear}-W${String(local.weekNumber).padStart(2, "0")}`;
}

export function toLocalDateString(utcDate: Date, ianaTz: string): string {
  return toLocationLocal(utcDate, ianaTz).toFormat("yyyy-MM-dd");
}

export function diffInHours(startUtc: Date, endUtc: Date): number {
  return (endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60);
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

function isNonexistentLocalTime(dt: DateTime, requestedHour: number, requestedMinute: number): boolean {
  return !dt.isValid || dt.hour !== requestedHour || dt.minute !== requestedMinute;
}

export function localWindowExistsOnDate(
  dateISO: string,
  ianaTz: string,
  startHHmm: string,
  endHHmm: string
): { startUtc: Date; endUtc: Date } | null {
  const [year, month, day] = dateISO.split("-").map(Number);
  const start = parseHHmm(startHHmm);
  const end = parseHHmm(endHHmm);

  const startDt = DateTime.fromObject(
    { year, month, day, hour: start.hour, minute: start.minute },
    { zone: ianaTz }
  );
  let endDt = DateTime.fromObject(
    { year, month, day, hour: end.hour, minute: end.minute },
    { zone: ianaTz }
  );

  if (isNonexistentLocalTime(startDt, start.hour, start.minute)) return null;

  const endMinutes = end.hour * 60 + end.minute;
  const startMinutes = start.hour * 60 + start.minute;
  const endRequestedNextDay = endMinutes <= startMinutes;
  if (endRequestedNextDay) {
    endDt = endDt.plus({ days: 1 });
  }
  const endDtForValidityCheck = endRequestedNextDay ? endDt.minus({ days: 1 }) : endDt;
  if (isNonexistentLocalTime(endDtForValidityCheck, end.hour, end.minute)) return null;
  if (startDt.toMillis() >= endDt.toMillis()) return null;

  return { startUtc: startDt.toUTC().toJSDate(), endUtc: endDt.toUTC().toJSDate() };
}
