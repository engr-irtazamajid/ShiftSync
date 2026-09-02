import { DateTime } from "luxon";

export function toLocalDateString(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(timezone).toFormat("yyyy-MM-dd");
}
