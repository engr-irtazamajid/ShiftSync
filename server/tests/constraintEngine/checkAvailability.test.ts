import { describe, expect, it } from "vitest";
import { AvailabilityType } from "@shiftsync/shared";
import { checkAvailability } from "../../src/constraintEngine/rules/checkAvailability";
import { buildContext, makeAvailability, makeLocation, makeShift, makeUser } from "./fixtures";

describe("checkAvailability", () => {
  it("passes when the shift is fully inside a recurring window", () => {
    const location = makeLocation({ timezone: "America/New_York" } as never);
    const staff = makeUser();
    // Friday 2026-09-04, 17:00-23:00 local (EDT, UTC-4) => 21:00-03:00 UTC
    const shift = makeShift(location, {
      startUtc: new Date("2026-09-04T21:00:00.000Z"),
      endUtc: new Date("2026-09-05T01:00:00.000Z"),
    });
    const availability = [
      makeAvailability(staff, {
        type: AvailabilityType.Recurring,
        dayOfWeek: 5, // Friday
        startLocalTime: "17:00",
        endLocalTime: "23:59",
      } as never),
      makeAvailability(staff, {
        type: AvailabilityType.Recurring,
        dayOfWeek: 6, // Saturday, covers the tail past midnight
        startLocalTime: "00:00",
        endLocalTime: "06:00",
      } as never),
    ];
    const ctx = buildContext({ staff, shift, location, availability });

    expect(checkAvailability(ctx).violations).toHaveLength(0);
  });

  it("blocks when the shift falls entirely outside stated availability", () => {
    const location = makeLocation({ timezone: "America/New_York" } as never);
    const staff = makeUser();
    const shift = makeShift(location, {
      startUtc: new Date("2026-09-04T21:00:00.000Z"),
      endUtc: new Date("2026-09-05T01:00:00.000Z"),
    });
    const availability = [
      makeAvailability(staff, {
        type: AvailabilityType.Recurring,
        dayOfWeek: 1, // Monday only
        startLocalTime: "09:00",
        endLocalTime: "17:00",
      } as never),
    ];
    const ctx = buildContext({ staff, shift, location, availability });

    const result = checkAvailability(ctx);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("block");
  });

  it("an exception for the date overrides the recurring window", () => {
    const location = makeLocation({ timezone: "America/New_York" } as never);
    const staff = makeUser();
    const shift = makeShift(location, {
      startUtc: new Date("2026-09-04T21:00:00.000Z"), // Friday evening
      endUtc: new Date("2026-09-05T01:00:00.000Z"),
    });
    const availability = [
      makeAvailability(staff, {
        type: AvailabilityType.Recurring,
        dayOfWeek: 5,
        startLocalTime: "17:00",
        endLocalTime: "23:59",
      } as never),
      makeAvailability(staff, {
        type: AvailabilityType.Exception,
        exceptionDate: "2026-09-04",
        isUnavailable: true,
      } as never),
    ];
    const ctx = buildContext({ staff, shift, location, availability });

    expect(checkAvailability(ctx).violations).toHaveLength(1);
  });

  it("treats a recurring window that falls entirely inside the DST spring-forward gap as unavailable that date", () => {
    const location = makeLocation({ timezone: "America/New_York" } as never);
    const staff = makeUser();

    // 2026-03-08 is the US spring-forward date; local clocks jump 02:00 -> 03:00,
    // so a recurring window of 02:00-02:30 has no real wall-clock instant that date.
    // tz.ts detects this by checking whether luxon silently normalized the requested
    // local time forward, and returns null rather than a resolved-but-wrong window —
    // so the staff member has no availability window to match against that day.
    const shift = makeShift(location, {
      startUtc: new Date("2026-03-08T07:00:00.000Z"),
      endUtc: new Date("2026-03-08T07:15:00.000Z"),
    });
    const availability = [
      makeAvailability(staff, {
        type: AvailabilityType.Recurring,
        dayOfWeek: 0, // Sunday
        startLocalTime: "02:00",
        endLocalTime: "02:30",
      } as never),
    ];
    const ctx = buildContext({ staff, shift, location, availability });

    const result = checkAvailability(ctx);
    expect(result.violations).toHaveLength(1);
  });

  it("blocks a shift scheduled at the literal (pre-DST-normalization) gap instant when availability doesn't cover the normalized window", () => {
    const location = makeLocation({ timezone: "America/New_York" } as never);
    const staff = makeUser();

    // Shift is scheduled for what a naive caller might assume is 02:00-02:30 EST
    // (fixed UTC-5 offset), i.e. 07:00-07:30 UTC — but since the availability
    // window is defined for a different, non-overlapping local slot, it should
    // still correctly block regardless of the DST edge.
    const shift = makeShift(location, {
      startUtc: new Date("2026-03-08T07:00:00.000Z"),
      endUtc: new Date("2026-03-08T07:30:00.000Z"),
    });
    const availability = [
      makeAvailability(staff, {
        type: AvailabilityType.Recurring,
        dayOfWeek: 0,
        startLocalTime: "10:00",
        endLocalTime: "14:00",
      } as never),
    ];
    const ctx = buildContext({ staff, shift, location, availability });

    const result = checkAvailability(ctx);
    expect(result.violations).toHaveLength(1);
  });

  it("resolves a normal window correctly on the day after a DST transition", () => {
    const location = makeLocation({ timezone: "America/New_York" } as never);
    const staff = makeUser();

    // 2026-03-09, the day after spring-forward, 09:00-17:00 EDT (UTC-4) => 13:00-21:00 UTC
    const shift = makeShift(location, {
      startUtc: new Date("2026-03-09T14:00:00.000Z"),
      endUtc: new Date("2026-03-09T20:00:00.000Z"),
    });
    const availability = [
      makeAvailability(staff, {
        type: AvailabilityType.Recurring,
        dayOfWeek: 1, // Monday
        startLocalTime: "09:00",
        endLocalTime: "17:00",
      } as never),
    ];
    const ctx = buildContext({ staff, shift, location, availability });

    expect(checkAvailability(ctx).violations).toHaveLength(0);
  });
});
