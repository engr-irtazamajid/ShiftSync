import { DateTime } from "luxon";

export function formatInZone(iso: string, timezone: string, format = "EEE MMM d, h:mm a"): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(timezone).toFormat(format);
}

export function currentWeekKey(timezone: string): string {
  const now = DateTime.now().setZone(timezone);
  return `${now.weekYear}-W${String(now.weekNumber).padStart(2, "0")}`;
}

export function shiftWeekKey(weekKey: string, delta: number, timezone: string): string {
  const [yearStr, weekStr] = weekKey.split("-W");
  const base = DateTime.fromObject(
    { weekYear: Number(yearStr), weekNumber: Number(weekStr), weekday: 1 },
    { zone: timezone }
  ).plus({ weeks: delta });
  return `${base.weekYear}-W${String(base.weekNumber).padStart(2, "0")}`;
}

export function weekKeyLabel(weekKey: string, timezone: string): string {
  const [yearStr, weekStr] = weekKey.split("-W");
  const start = DateTime.fromObject(
    { weekYear: Number(yearStr), weekNumber: Number(weekStr), weekday: 1 },
    { zone: timezone }
  );
  const end = start.plus({ days: 6 });
  return `${start.toFormat("MMM d")} – ${end.toFormat("MMM d, yyyy")}`;
}
