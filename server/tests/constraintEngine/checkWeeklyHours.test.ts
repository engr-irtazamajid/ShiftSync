import { describe, expect, it } from "vitest";
import { checkWeeklyHours } from "../../src/constraintEngine/rules/checkWeeklyHours";
import { buildContext, makeAssignment, makeLocation, makeShift, makeUser } from "./fixtures";

describe("checkWeeklyHours", () => {
  it("does not warn under 35 hours", () => {
    const location = makeLocation();
    const staff = makeUser();
    const shift = makeShift(location, {
      startUtc: new Date("2026-09-08T13:00:00.000Z"),
      endUtc: new Date("2026-09-08T21:00:00.000Z"), // 8h, same week
    });
    const ctx = buildContext({ staff, shift, location });

    expect(checkWeeklyHours(ctx).warnings).toHaveLength(0);
  });

  it("warns once total weekly hours reach 35", () => {
    const location = makeLocation();
    const staff = makeUser();

    // 4 existing 8h shifts = 32h, same ISO week (Mon 2026-09-07 .. Sun 2026-09-13)
    const activeAssignments = [7, 8, 9, 10].map((day) => {
      const start = new Date(`2026-09-${String(day).padStart(2, "0")}T13:00:00.000Z`);
      const end = new Date(`2026-09-${String(day).padStart(2, "0")}T21:00:00.000Z`);
      const shift = makeShift(location, { startUtc: start, endUtc: end });
      return { assignment: makeAssignment(shift, staff), shift };
    });

    // candidate adds 4h more -> 36h total, crossing the 35h warn line
    const candidateShift = makeShift(location, {
      startUtc: new Date("2026-09-11T13:00:00.000Z"),
      endUtc: new Date("2026-09-11T17:00:00.000Z"),
    });

    const ctx = buildContext({ staff, shift: candidateShift, location, activeAssignments });

    const result = checkWeeklyHours(ctx);
    expect(result.warnings).toHaveLength(1);
  });
});
