import { describe, expect, it } from "vitest";
import { checkDailyHours } from "../../src/constraintEngine/rules/checkDailyHours";
import { buildContext, makeLocation, makeShift, makeUser } from "./fixtures";

describe("checkDailyHours", () => {
  it("passes with no warning at exactly 8 hours", () => {
    const location = makeLocation();
    const staff = makeUser();
    const shift = makeShift(location, {
      startUtc: new Date("2026-09-08T13:00:00.000Z"), // 09:00 local (EDT, UTC-4)
      endUtc: new Date("2026-09-08T21:00:00.000Z"), // 17:00 local
    });
    const ctx = buildContext({ staff, shift, location });

    const result = checkDailyHours(ctx);
    expect(result.violations).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns above 8 hours but under 12", () => {
    const location = makeLocation();
    const staff = makeUser();
    const shift = makeShift(location, {
      startUtc: new Date("2026-09-08T13:00:00.000Z"),
      endUtc: new Date("2026-09-08T22:30:00.000Z"), // 9.5h
    });
    const ctx = buildContext({ staff, shift, location });

    const result = checkDailyHours(ctx);
    expect(result.violations).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  it("hard-blocks above 12 hours", () => {
    const location = makeLocation();
    const staff = makeUser();
    const shift = makeShift(location, {
      startUtc: new Date("2026-09-08T09:00:00.000Z"),
      endUtc: new Date("2026-09-08T22:00:00.000Z"), // 13h
    });
    const ctx = buildContext({ staff, shift, location });

    const result = checkDailyHours(ctx);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("block");
  });
});
