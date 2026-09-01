import { describe, expect, it } from "vitest";
import { checkMinRest } from "../../src/constraintEngine/rules/checkMinRest";
import { buildContext, makeAssignment, makeLocation, makeShift, makeUser } from "./fixtures";

describe("checkMinRest", () => {
  it("passes at exactly 10 hours of rest (boundary)", () => {
    const location = makeLocation();
    const staff = makeUser();

    const existingShift = makeShift(location, {
      startUtc: new Date("2026-09-04T12:00:00.000Z"),
      endUtc: new Date("2026-09-04T20:00:00.000Z"), // ends 20:00
    });
    const existingAssignment = makeAssignment(existingShift, staff);

    // starts exactly 10h after prior shift ends: 20:00 + 10h = 06:00 next day
    const candidateShift = makeShift(location, {
      startUtc: new Date("2026-09-05T06:00:00.000Z"),
      endUtc: new Date("2026-09-05T14:00:00.000Z"),
    });

    const ctx = buildContext({
      staff,
      shift: candidateShift,
      location,
      activeAssignments: [{ assignment: existingAssignment, shift: existingShift }],
    });

    expect(checkMinRest(ctx).violations).toHaveLength(0);
  });

  it("blocks at 9h59m of rest (one minute short of boundary)", () => {
    const location = makeLocation();
    const staff = makeUser();

    const existingShift = makeShift(location, {
      startUtc: new Date("2026-09-04T12:00:00.000Z"),
      endUtc: new Date("2026-09-04T20:00:00.000Z"),
    });
    const existingAssignment = makeAssignment(existingShift, staff);

    // 9h59m after prior shift ends
    const candidateShift = makeShift(location, {
      startUtc: new Date("2026-09-05T05:59:00.000Z"),
      endUtc: new Date("2026-09-05T13:59:00.000Z"),
    });

    const ctx = buildContext({
      staff,
      shift: candidateShift,
      location,
      activeAssignments: [{ assignment: existingAssignment, shift: existingShift }],
    });

    const result = checkMinRest(ctx);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("block");
  });

  it("checks rest against a following shift as well as a preceding one", () => {
    const location = makeLocation();
    const staff = makeUser();

    const existingShift = makeShift(location, {
      startUtc: new Date("2026-09-05T14:00:00.000Z"),
      endUtc: new Date("2026-09-05T22:00:00.000Z"),
    });
    const existingAssignment = makeAssignment(existingShift, staff);

    // candidate ends only 5h before the existing shift starts
    const candidateShift = makeShift(location, {
      startUtc: new Date("2026-09-05T01:00:00.000Z"),
      endUtc: new Date("2026-09-05T09:00:00.000Z"),
    });

    const ctx = buildContext({
      staff,
      shift: candidateShift,
      location,
      activeAssignments: [{ assignment: existingAssignment, shift: existingShift }],
    });

    expect(checkMinRest(ctx).violations).toHaveLength(1);
  });
});
