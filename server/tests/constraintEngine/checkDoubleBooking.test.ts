import { describe, expect, it } from "vitest";
import { checkDoubleBooking } from "../../src/constraintEngine/rules/checkDoubleBooking";
import { buildContext, makeAssignment, makeLocation, makeShift, makeUser } from "./fixtures";

describe("checkDoubleBooking", () => {
  it("blocks an overlapping shift even across two different locations", () => {
    const locationA = makeLocation({ name: "Location A", timezone: "America/Los_Angeles" } as never);
    const locationB = makeLocation({ name: "Location B", timezone: "America/New_York" } as never);
    const staff = makeUser();

    const existingShift = makeShift(locationA, {
      startUtc: new Date("2026-09-04T18:00:00.000Z"),
      endUtc: new Date("2026-09-05T02:00:00.000Z"),
    });
    const existingAssignment = makeAssignment(existingShift, staff);

    const candidateShift = makeShift(locationB, {
      startUtc: new Date("2026-09-04T20:00:00.000Z"),
      endUtc: new Date("2026-09-05T04:00:00.000Z"),
    });

    const ctx = buildContext({
      staff,
      shift: candidateShift,
      location: locationB,
      activeAssignments: [{ assignment: existingAssignment, shift: existingShift }],
      otherLocations: [locationA],
    });

    const result = checkDoubleBooking(ctx);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("block");
  });

  it("passes when shifts are back-to-back with no overlap", () => {
    const location = makeLocation();
    const staff = makeUser();

    const existingShift = makeShift(location, {
      startUtc: new Date("2026-09-04T12:00:00.000Z"),
      endUtc: new Date("2026-09-04T20:00:00.000Z"),
    });
    const existingAssignment = makeAssignment(existingShift, staff);

    const candidateShift = makeShift(location, {
      startUtc: new Date("2026-09-04T20:00:00.000Z"),
      endUtc: new Date("2026-09-05T04:00:00.000Z"),
    });

    const ctx = buildContext({
      staff,
      shift: candidateShift,
      location,
      activeAssignments: [{ assignment: existingAssignment, shift: existingShift }],
    });

    expect(checkDoubleBooking(ctx).violations).toHaveLength(0);
  });
});
