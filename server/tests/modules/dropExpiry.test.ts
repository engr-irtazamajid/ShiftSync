import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Role, ShiftStatus, AssignmentStatus, SwapType, SwapStatus, NotificationType } from "@shiftsync/shared";
import { UserModel } from "../../src/models/User";
import { LocationModel } from "../../src/models/Location";
import { SkillModel } from "../../src/models/Skill";
import { ShiftModel, computeIsPremium } from "../../src/models/Shift";
import { AssignmentModel } from "../../src/models/Assignment";
import { SwapRequestModel } from "../../src/models/SwapRequest";
import { NotificationModel } from "../../src/models/Notification";
import { sweepExpiredDrops } from "../../src/jobs/dropExpiry";
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

async function makeBaseFixtures() {
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
  const claimant = await UserModel.create({
    email: "claimant@test.com",
    passwordHash: "x",
    role: Role.Staff,
    firstName: "C",
    lastName: "L",
    managedLocationIds: [],
    skillIds: [skill._id],
  });

  const start = new Date("2026-09-10T17:00:00.000Z");
  const end = new Date("2026-09-10T21:00:00.000Z");
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
  const assignment = await AssignmentModel.create({
    shiftId: shift._id,
    staffId: staff._id,
    status: AssignmentStatus.Active,
    version: 0,
    assignedBy: manager._id,
    assignedAt: new Date(),
  });

  return { location, manager, staff, claimant, shift, assignment };
}

describe("sweepExpiredDrops", () => {
  it("expires an unclaimed drop past its expiry time", async () => {
    const { assignment, staff } = await makeBaseFixtures();

    const drop = await SwapRequestModel.create({
      type: SwapType.Drop,
      assignmentId: assignment._id,
      requestedBy: staff._id,
      status: SwapStatus.PendingClaim,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const modifiedCount = await sweepExpiredDrops();
    expect(modifiedCount).toBe(1);

    const reloaded = await SwapRequestModel.findById(drop._id);
    expect(reloaded!.status).toBe(SwapStatus.Expired);

    const notifications = await NotificationModel.find({
      userId: staff._id,
      type: NotificationType.SwapResolved,
    });
    expect(notifications).toHaveLength(1);
  });

  it("does NOT expire a drop already claimed and awaiting manager approval, even past its original expiry time", async () => {
    const { assignment, staff, claimant } = await makeBaseFixtures();

    const drop = await SwapRequestModel.create({
      type: SwapType.Drop,
      assignmentId: assignment._id,
      requestedBy: staff._id,
      claimedBy: claimant._id,
      status: SwapStatus.PendingManagerApproval,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const modifiedCount = await sweepExpiredDrops();
    expect(modifiedCount).toBe(0);

    const reloaded = await SwapRequestModel.findById(drop._id);
    expect(reloaded!.status).toBe(SwapStatus.PendingManagerApproval);
  });

  it("leaves an unexpired pending_claim drop untouched", async () => {
    const { assignment, staff } = await makeBaseFixtures();

    const drop = await SwapRequestModel.create({
      type: SwapType.Drop,
      assignmentId: assignment._id,
      requestedBy: staff._id,
      status: SwapStatus.PendingClaim,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const modifiedCount = await sweepExpiredDrops();
    expect(modifiedCount).toBe(0);

    const reloaded = await SwapRequestModel.findById(drop._id);
    expect(reloaded!.status).toBe(SwapStatus.PendingClaim);
  });
});
