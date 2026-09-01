import { describe, expect, it } from "vitest";
import { checkConsecutiveDays } from "../../src/constraintEngine/rules/checkConsecutiveDays";
import { buildContext, makeAssignment, makeLocation, makeShift, makeUser } from "./fixtures";

function dailyShift(location: ReturnType<typeof makeLocation>, dayOfMonth: number) {
  const day = String(dayOfMonth).padStart(2, "0");
  return makeShift(location, {
    startUtc: new Date(`2026-09-${day}T13:00:00.000Z`),
    endUtc: new Date(`2026-09-${day}T21:00:00.000Z`),
  });
}

describe("checkConsecutiveDays", () => {
  it("warns on the 6th consecutive day", () => {
    const location = makeLocation();
    const staff = makeUser();

    const activeAssignments = [1, 2, 3, 4, 5].map((day) => {
      const shift = dailyShift(location, day);
      return { assignment: makeAssignment(shift, staff), shift };
    });
    const candidateShift = dailyShift(location, 6);

    const ctx = buildContext({ staff, shift: candidateShift, location, activeAssignments });
    const result = checkConsecutiveDays(ctx);

    expect(result.violations).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  it("blocks the 7th consecutive day without an override", () => {
    const location = makeLocation();
    const staff = makeUser();

    const activeAssignments = [1, 2, 3, 4, 5, 6].map((day) => {
      const shift = dailyShift(location, day);
      return { assignment: makeAssignment(shift, staff), shift };
    });
    const candidateShift = dailyShift(location, 7);

    const ctx = buildContext({ staff, shift: candidateShift, location, activeAssignments });
    const result = checkConsecutiveDays(ctx);

    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("block");
  });

  it("allows the 7th consecutive day with a manager override and reason", () => {
    const location = makeLocation();
    const staff = makeUser();

    const activeAssignments = [1, 2, 3, 4, 5, 6].map((day) => {
      const shift = dailyShift(location, day);
      return { assignment: makeAssignment(shift, staff), shift };
    });
    const candidateShift = dailyShift(location, 7);

    const ctx = buildContext({
      staff,
      shift: candidateShift,
      location,
      activeAssignments,
      allowManagerOverride: true,
      overrideReason: "Coverage emergency, approved by admin",
    });
    const result = checkConsecutiveDays(ctx);

    expect(result.violations).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  it("still blocks the 7th day if override flag is set but reason is empty", () => {
    const location = makeLocation();
    const staff = makeUser();

    const activeAssignments = [1, 2, 3, 4, 5, 6].map((day) => {
      const shift = dailyShift(location, day);
      return { assignment: makeAssignment(shift, staff), shift };
    });
    const candidateShift = dailyShift(location, 7);

    const ctx = buildContext({
      staff,
      shift: candidateShift,
      location,
      activeAssignments,
      allowManagerOverride: true,
      overrideReason: "",
    });
    const result = checkConsecutiveDays(ctx);

    expect(result.violations).toHaveLength(1);
  });

  it("counts both calendar days an overnight shift touches", () => {
    const location = makeLocation();
    const staff = makeUser();

    // 5 straight days worked via overnight shifts touching day N and N+1
    const activeAssignments = [1, 2, 3, 4].map((day) => {
      const startDay = String(day).padStart(2, "0");
      const endDay = String(day + 1).padStart(2, "0");
      const shift = makeShift(location, {
        startUtc: new Date(`2026-09-${startDay}T23:00:00.000Z`),
        endUtc: new Date(`2026-09-${endDay}T07:00:00.000Z`),
      });
      return { assignment: makeAssignment(shift, staff), shift };
    });
    // worked dates so far: 1,2,3,4,5 (5 distinct consecutive days from 4 overnight shifts)
    const candidateShift = dailyShift(location, 6);

    const ctx = buildContext({ staff, shift: candidateShift, location, activeAssignments });
    const result = checkConsecutiveDays(ctx);

    // day 6 is the 6th consecutive day (1-6)
    expect(result.warnings).toHaveLength(1);
    expect(result.violations).toHaveLength(0);
  });
});
