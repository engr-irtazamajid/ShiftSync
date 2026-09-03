import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
  Role,
  ShiftStatus,
  AssignmentStatus,
  NotificationType,
  AuditAction,
} from "@shiftsync/shared";
import { UserModel } from "../../src/models/User";
import { LocationModel } from "../../src/models/Location";
import { SkillModel } from "../../src/models/Skill";
import { ShiftModel, computeIsPremium } from "../../src/models/Shift";
import { AssignmentModel } from "../../src/models/Assignment";
import { NotificationModel } from "../../src/models/Notification";
import { AuditLogModel } from "../../src/models/AuditLog";
import { publishShifts, unpublishShifts } from "../../src/modules/shifts/service";
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

async function makeFixtures() {
  const location = await LocationModel.create({ name: "Test", timezone: "America/Los_Angeles" });
  const skill = await SkillModel.create({ name: "server" });
  const manager = await UserModel.create({
    email: "mgr@test.com",
    passwordHash: "x",
    role: Role.Manager,
    firstName: "M",
    lastName: "G",
    managedLocationIds: [location._id],
    skillIds: [],
  });
  const staff = await UserModel.create({
    email: "staff@test.com",
    passwordHash: "x",
    role: Role.Staff,
    firstName: "S",
    lastName: "T",
    managedLocationIds: [],
    skillIds: [skill._id],
  });

  const start = new Date("2026-09-10T17:00:00.000Z");
  const end = new Date("2026-09-10T21:00:00.000Z");
  const weekKey = computeWeekKey(start, location.timezone);
  const shift = await ShiftModel.create({
    locationId: location._id,
    requiredSkillId: skill._id,
    startUtc: start,
    endUtc: end,
    headcount: 1,
    status: ShiftStatus.Draft,
    weekKey,
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

  return { location, manager, staff, shift, weekKey };
}

describe("publishShifts / unpublishShifts", () => {
  it("flips draft shifts to published and notifies assigned staff", async () => {
    const { location, manager, staff, shift, weekKey } = await makeFixtures();

    const publishedIds = await publishShifts(
      location.id.toString(),
      weekKey,
      manager.id.toString()
    );
    expect(publishedIds).toEqual([shift.id.toString()]);

    const reloaded = await ShiftModel.findById(shift._id);
    expect(reloaded!.status).toBe(ShiftStatus.Published);

    const notifications = await NotificationModel.find({
      userId: staff._id,
      type: NotificationType.SchedulePublished,
    });
    expect(notifications).toHaveLength(1);

    const auditRows = await AuditLogModel.find({
      entityId: shift._id,
      action: AuditAction.Publish,
    });
    expect(auditRows).toHaveLength(1);
  });

  it("flips published shifts back to draft and notifies assigned staff on unpublish", async () => {
    const { location, manager, staff, shift, weekKey } = await makeFixtures();
    await publishShifts(location.id.toString(), weekKey, manager.id.toString());

    const unpublishedIds = await unpublishShifts(
      location.id.toString(),
      weekKey,
      manager.id.toString()
    );
    expect(unpublishedIds).toEqual([shift.id.toString()]);

    const reloaded = await ShiftModel.findById(shift._id);
    expect(reloaded!.status).toBe(ShiftStatus.Draft);

    const notifications = await NotificationModel.find({
      userId: staff._id,
      type: NotificationType.ShiftChanged,
    });
    expect(notifications).toHaveLength(1);
  });

  it("is a no-op when there are no draft shifts to publish", async () => {
    const location = await LocationModel.create({ name: "Empty", timezone: "America/Los_Angeles" });
    const manager = await UserModel.create({
      email: "mgr2@test.com",
      passwordHash: "x",
      role: Role.Manager,
      firstName: "M",
      lastName: "G2",
      managedLocationIds: [location._id],
      skillIds: [],
    });

    const publishedIds = await publishShifts(
      location.id.toString(),
      "2026-W99",
      manager.id.toString()
    );
    expect(publishedIds).toEqual([]);
  });
});
