import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Role, ShiftStatus, AssignmentStatus, NotificationType } from "@shiftsync/shared";
import { UserModel } from "../../src/models/User";
import { LocationModel } from "../../src/models/Location";
import { SkillModel } from "../../src/models/Skill";
import { CertificationModel } from "../../src/models/Certification";
import { AvailabilityModel } from "../../src/models/Availability";
import { ShiftModel, computeIsPremium } from "../../src/models/Shift";
import { AssignmentModel } from "../../src/models/Assignment";
import { NotificationModel } from "../../src/models/Notification";
import { assignStaff } from "../../src/modules/assignments/service";
import { computeWeekKey } from "../../src/time/tz";

let replSet: MongoMemoryReplSet;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

describe("OT warning notification on assignment", () => {
  it("notifies admins and managers when an assignment pushes staff over 40h/week", async () => {
    const location = await LocationModel.create({
      name: "Test Location",
      timezone: "America/Los_Angeles",
    });
    const skill = await SkillModel.create({ name: "bartender" });

    const admin = await UserModel.create({
      email: "admin@test.com",
      passwordHash: "x",
      role: Role.Admin,
      firstName: "Ad",
      lastName: "Min",
      managedLocationIds: [],
      skillIds: [],
    });
    const manager = await UserModel.create({
      email: "manager@test.com",
      passwordHash: "x",
      role: Role.Manager,
      firstName: "Man",
      lastName: "Ager",
      managedLocationIds: [location._id],
      skillIds: [],
    });
    const staff = await UserModel.create({
      email: "staff@test.com",
      passwordHash: "x",
      role: Role.Staff,
      firstName: "Staf",
      lastName: "Fer",
      managedLocationIds: [],
      skillIds: [skill._id],
    });

    await CertificationModel.create({
      staffId: staff._id,
      locationId: location._id,
      certifiedAt: new Date(),
      revokedAt: null,
    });

    // Broad availability covering the whole week so the constraint engine never blocks.
    for (let day = 0; day <= 6; day++) {
      await AvailabilityModel.create({
        staffId: staff._id,
        type: "recurring",
        dayOfWeek: day,
        startLocalTime: "00:00",
        endLocalTime: "23:59",
      });
    }

    const weekAnchor = new Date("2026-09-07T17:00:00.000Z"); // a Monday 10am Pacific

    async function makeAssignedShift(dayOffset: number, hours: number) {
      const start = new Date(weekAnchor.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
      const shift = await ShiftModel.create({
        locationId: location._id,
        requiredSkillId: skill._id,
        startUtc: start,
        endUtc: end,
        headcount: 1,
        status: ShiftStatus.Published,
        weekKey: computeWeekKey(start, location.timezone),
        isPremium: computeIsPremium(start, location.timezone),
        version: 0,
        createdBy: manager._id,
        updatedBy: manager._id,
      });
      await AssignmentModel.create({
        shiftId: shift._id,
        staffId: staff._id,
        status: AssignmentStatus.Active,
        version: 0,
        assignedBy: manager._id,
        assignedAt: new Date(),
      });
      return shift;
    }

    // Pre-existing 32h this week (4 x 8h days), under the 40h threshold.
    for (let day = 0; day < 4; day++) {
      await makeAssignedShift(day, 8);
    }

    const newShiftStart = new Date(weekAnchor.getTime() + 4 * 24 * 60 * 60 * 1000);
    const newShiftEnd = new Date(newShiftStart.getTime() + 10 * 60 * 60 * 1000);
    const newShift = await ShiftModel.create({
      locationId: location._id,
      requiredSkillId: skill._id,
      startUtc: newShiftStart,
      endUtc: newShiftEnd,
      headcount: 1,
      status: ShiftStatus.Draft,
      weekKey: computeWeekKey(newShiftStart, location.timezone),
      isPremium: computeIsPremium(newShiftStart, location.timezone),
      version: 0,
      createdBy: manager._id,
      updatedBy: manager._id,
    });

    await assignStaff({
      shiftId: newShift.id.toString(),
      staffId: staff.id.toString(),
      expectedShiftVersion: 0,
      requestedBy: manager.id.toString(),
      isAdmin: false,
      managerLocationIds: [location.id.toString()],
    });

    const notifications = await NotificationModel.find({ type: NotificationType.OvertimeWarning });
    const recipientIds = notifications.map((n) => n.userId.toString()).sort();
    const expectedIds = [admin.id.toString(), manager.id.toString()].sort();

    expect(recipientIds).toEqual(expectedIds);
    // 32h existing (4 x 8h) + 10h new = 42h, clearly over the 40h threshold, not exactly on it
    expect(notifications[0].body).toContain("42.0h");
  });

  it("does not notify when staff stays under 40h", async () => {
    const location = await LocationModel.create({
      name: "Test Location 2",
      timezone: "America/Los_Angeles",
    });
    const skill = await SkillModel.create({ name: "server" });

    const manager = await UserModel.create({
      email: "manager2@test.com",
      passwordHash: "x",
      role: Role.Manager,
      firstName: "Man",
      lastName: "Ager2",
      managedLocationIds: [location._id],
      skillIds: [],
    });
    const staff = await UserModel.create({
      email: "staff2@test.com",
      passwordHash: "x",
      role: Role.Staff,
      firstName: "Staf",
      lastName: "Fer2",
      managedLocationIds: [],
      skillIds: [skill._id],
    });

    await CertificationModel.create({
      staffId: staff._id,
      locationId: location._id,
      certifiedAt: new Date(),
      revokedAt: null,
    });

    for (let day = 0; day <= 6; day++) {
      await AvailabilityModel.create({
        staffId: staff._id,
        type: "recurring",
        dayOfWeek: day,
        startLocalTime: "00:00",
        endLocalTime: "23:59",
      });
    }

    const start = new Date("2026-09-07T17:00:00.000Z");
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const shift = await ShiftModel.create({
      locationId: location._id,
      requiredSkillId: skill._id,
      startUtc: start,
      endUtc: end,
      headcount: 1,
      status: ShiftStatus.Draft,
      weekKey: computeWeekKey(start, location.timezone),
      isPremium: computeIsPremium(start, location.timezone),
      version: 0,
      createdBy: manager._id,
      updatedBy: manager._id,
    });

    await assignStaff({
      shiftId: shift.id.toString(),
      staffId: staff.id.toString(),
      expectedShiftVersion: 0,
      requestedBy: manager.id.toString(),
      isAdmin: false,
      managerLocationIds: [location.id.toString()],
    });

    const notifications = await NotificationModel.find({ type: NotificationType.OvertimeWarning });
    expect(notifications).toHaveLength(0);
  });
});
