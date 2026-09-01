import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { AssignmentStatus, AvailabilityType, Role, ShiftStatus } from "@shiftsync/shared";
import { evaluateAssignment } from "../../src/constraintEngine";
import { UserModel } from "../../src/models/User";
import { LocationModel } from "../../src/models/Location";
import { SkillModel } from "../../src/models/Skill";
import { ShiftModel, computeIsPremium } from "../../src/models/Shift";
import { AssignmentModel } from "../../src/models/Assignment";
import { CertificationModel } from "../../src/models/Certification";
import { AvailabilityModel } from "../../src/models/Availability";
import { computeWeekKey } from "../../src/time/tz";

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: "shiftsync-test" });
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

async function seedBasics() {
  const location = await LocationModel.create({
    name: "Downtown",
    timezone: "America/New_York",
    address: null,
    isActive: true,
  });
  const skill = await SkillModel.create({ name: "Barista" });
  const staff = await UserModel.create({
    email: "staff@example.com",
    passwordHash: "hash",
    role: Role.Staff,
    firstName: "Jamie",
    lastName: "Rivera",
    managedLocationIds: [],
    skillIds: [skill._id],
    desiredWeeklyHours: 30,
  });
  await CertificationModel.create({
    staffId: staff._id,
    locationId: location._id,
    certifiedAt: new Date("2024-01-01"),
    revokedAt: null,
    revokedReason: null,
  });
  await AvailabilityModel.create({
    staffId: staff._id,
    type: AvailabilityType.Recurring,
    dayOfWeek: 5,
    startLocalTime: "09:00",
    endLocalTime: "23:59",
  });

  const startUtc = new Date("2026-09-04T13:00:00.000Z"); // Friday 09:00 EDT
  const endUtc = new Date("2026-09-04T21:00:00.000Z"); // 17:00 EDT
  const shift = await ShiftModel.create({
    locationId: location._id,
    requiredSkillId: skill._id,
    startUtc,
    endUtc,
    headcount: 1,
    status: ShiftStatus.Published,
    weekKey: computeWeekKey(startUtc, location.timezone),
    isPremium: computeIsPremium(startUtc, location.timezone),
    version: 0,
    createdBy: staff._id,
    updatedBy: staff._id,
  });

  return { location, skill, staff, shift };
}

describe("evaluateAssignment (integration, real Mongoose queries)", () => {
  it("passes for a qualified, available, unbooked staff member", async () => {
    const { staff, shift } = await seedBasics();

    const result = await evaluateAssignment({
      staffId: staff.id.toString(),
      shiftId: shift.id.toString(),
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("blocks and suggests alternatives when the staff member lacks the skill, then finds a qualified alternative", async () => {
    const { location, skill, shift } = await seedBasics();

    const unqualifiedStaff = await UserModel.create({
      email: "nope@example.com",
      passwordHash: "hash",
      role: Role.Staff,
      firstName: "No",
      lastName: "Skill",
      skillIds: [],
    });

    const alternative = await UserModel.create({
      email: "alt@example.com",
      passwordHash: "hash",
      role: Role.Staff,
      firstName: "Alt",
      lastName: "Erna",
      skillIds: [skill._id],
    });
    await CertificationModel.create({
      staffId: alternative._id,
      locationId: location._id,
      certifiedAt: new Date("2024-01-01"),
      revokedAt: null,
      revokedReason: null,
    });
    await AvailabilityModel.create({
      staffId: alternative._id,
      type: AvailabilityType.Recurring,
      dayOfWeek: 5,
      startLocalTime: "00:00",
      endLocalTime: "23:59",
    });

    const result = await evaluateAssignment({
      staffId: unqualifiedStaff.id.toString(),
      shiftId: shift.id.toString(),
    });

    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.rule === "SKILL_MISMATCH")).toBe(true);
    expect(result.suggestedAlternatives.map((a) => a.staffId)).toContain(alternative.id.toString());
  });

  it("respects an active session so a mid-transaction assignment is visible to a concurrent evaluation in the same session", async () => {
    const { location, skill, staff, shift } = await seedBasics();

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await AssignmentModel.create(
          [
            {
              shiftId: shift._id,
              staffId: staff._id,
              status: AssignmentStatus.Active,
              version: 0,
              assignedBy: staff._id,
              assignedAt: new Date(),
            },
          ],
          { session }
        );

        const overlappingShift = await ShiftModel.create(
          [
            {
              locationId: location._id,
              requiredSkillId: skill._id,
              startUtc: shift.startUtc,
              endUtc: shift.endUtc,
              headcount: 1,
              status: ShiftStatus.Published,
              weekKey: shift.weekKey,
              isPremium: shift.isPremium,
              version: 0,
              createdBy: staff._id,
              updatedBy: staff._id,
            },
          ],
          { session }
        );

        const result = await evaluateAssignment({
          staffId: staff.id.toString(),
          shiftId: overlappingShift[0].id.toString(),
          session,
        });

        expect(result.passed).toBe(false);
        expect(result.violations.some((v) => v.rule === "DOUBLE_BOOKING")).toBe(true);
      });
    } finally {
      await session.endSession();
    }
  });
});
