import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { DateTime } from "luxon";
import {
  AssignmentStatus,
  AuditAction,
  AuditEntityType,
  AvailabilityType,
  NotificationChannel,
  NotificationType,
  Role,
  ShiftStatus,
  SwapStatus,
  SwapType,
} from "@shiftsync/shared";
import { env } from "../src/config/env";
import {
  UserModel,
  LocationModel,
  SkillModel,
  CertificationModel,
  AvailabilityModel,
  NotificationPreferenceModel,
  NotificationModel,
  AuditLogModel,
} from "../src/models";
import { ShiftModel, computeIsPremium } from "../src/models/Shift";
import { AssignmentModel } from "../src/models/Assignment";
import { SwapRequestModel } from "../src/models/SwapRequest";
import { computeWeekKey } from "../src/time/tz";

const SALT_ROUNDS = 10;

interface SeededUser {
  id: mongoose.Types.ObjectId;
  email: string;
  role: Role;
}

async function wipe(): Promise<void> {
  await Promise.all([
    UserModel.deleteMany({}),
    LocationModel.deleteMany({}),
    SkillModel.deleteMany({}),
    CertificationModel.deleteMany({}),
    AvailabilityModel.deleteMany({}),
    ShiftModel.deleteMany({}),
    AssignmentModel.deleteMany({}),
    SwapRequestModel.deleteMany({}),
    NotificationPreferenceModel.deleteMany({}),
    mongoose.connection.collection("notifications").deleteMany({}),
    mongoose.connection.collection("auditlogs").deleteMany({}),
  ]);
}

async function seedLocations() {
  return LocationModel.create([
    {
      name: "Downtown LA",
      timezone: "America/Los_Angeles",
      address: "123 Spring St, Los Angeles, CA",
    },
    {
      name: "Santa Monica",
      timezone: "America/Los_Angeles",
      address: "456 Ocean Ave, Santa Monica, CA",
    },
    { name: "Midtown NYC", timezone: "America/New_York", address: "789 5th Ave, New York, NY" },
    {
      name: "Brooklyn Heights",
      timezone: "America/New_York",
      address: "321 Montague St, Brooklyn, NY",
    },
  ]);
}

async function seedSkills() {
  return SkillModel.create(
    ["bartender", "line_cook", "server", "host", "barback", "dishwasher"].map((name) => ({ name }))
  );
}

async function hashPassword(): Promise<string> {
  return bcrypt.hash(env.seedPassword, SALT_ROUNDS);
}

async function main(): Promise<void> {
  await mongoose.connect(env.mongoUri);
  console.log("Connected. Wiping existing data...");
  await wipe();

  const [downtownLA, santaMonica, midtownNYC, brooklynHeights] = await seedLocations();
  const [bartender, lineCook, server, host, barback, dishwasher] = await seedSkills();

  const passwordHash = await hashPassword();
  const credentials: Array<{ email: string; role: string; note: string }> = [];

  const admin = await UserModel.create({
    email: "admin@coastaleats.com",
    passwordHash,
    role: Role.Admin,
    firstName: "Alex",
    lastName: "Rivera",
    managedLocationIds: [],
    skillIds: [],
  });
  credentials.push({ email: admin.email, role: "admin", note: "Full cross-location visibility" });

  const managerLA = await UserModel.create({
    email: "manager.la@coastaleats.com",
    passwordHash,
    role: Role.Manager,
    firstName: "Jordan",
    lastName: "Kim",
    managedLocationIds: [downtownLA._id, santaMonica._id],
    skillIds: [],
  });
  credentials.push({ email: managerLA.email, role: "manager", note: "Manages both LA locations" });

  const managerNYC = await UserModel.create({
    email: "manager.nyc@coastaleats.com",
    passwordHash,
    role: Role.Manager,
    firstName: "Taylor",
    lastName: "Nguyen",
    managedLocationIds: [midtownNYC._id, brooklynHeights._id],
    skillIds: [],
  });
  credentials.push({
    email: managerNYC.email,
    role: "manager",
    note: "Manages both NYC locations",
  });

  const managerMixed = await UserModel.create({
    email: "manager.mixed@coastaleats.com",
    passwordHash,
    role: Role.Manager,
    firstName: "Sam",
    lastName: "Patel",
    managedLocationIds: [santaMonica._id, midtownNYC._id],
    skillIds: [],
  });
  credentials.push({
    email: managerMixed.email,
    role: "manager",
    note: "Manages one LA + one NYC location (cross-timezone scope)",
  });

  const staffDefs: Array<{
    firstName: string;
    lastName: string;
    skills: mongoose.Types.ObjectId[];
    desiredWeeklyHours: number | null;
    locations: mongoose.Types.ObjectId[];
  }> = [
    {
      firstName: "Sarah",
      lastName: "Chen",
      skills: [bartender._id, server._id],
      desiredWeeklyHours: 32,
      locations: [downtownLA._id],
    },
    {
      firstName: "John",
      lastName: "Diaz",
      skills: [bartender._id],
      desiredWeeklyHours: 30,
      locations: [downtownLA._id],
    },
    {
      firstName: "Maria",
      lastName: "Lopez",
      skills: [bartender._id, host._id],
      desiredWeeklyHours: 25,
      locations: [downtownLA._id, santaMonica._id],
    },
    {
      firstName: "Chris",
      lastName: "Evans",
      skills: [lineCook._id],
      desiredWeeklyHours: 38,
      locations: [downtownLA._id],
    },
    {
      firstName: "Priya",
      lastName: "Shah",
      skills: [lineCook._id, dishwasher._id],
      desiredWeeklyHours: 35,
      locations: [santaMonica._id],
    },
    {
      firstName: "Marcus",
      lastName: "Johnson",
      skills: [server._id, host._id],
      desiredWeeklyHours: 20,
      locations: [santaMonica._id],
    },
    {
      firstName: "Emily",
      lastName: "White",
      skills: [server._id],
      desiredWeeklyHours: 28,
      locations: [santaMonica._id],
    },
    {
      firstName: "David",
      lastName: "Kim",
      skills: [barback._id, dishwasher._id],
      desiredWeeklyHours: 25,
      locations: [downtownLA._id, santaMonica._id],
    },
    {
      firstName: "Olivia",
      lastName: "Brown",
      skills: [bartender._id, server._id],
      desiredWeeklyHours: 30,
      locations: [midtownNYC._id],
    },
    {
      firstName: "Ethan",
      lastName: "Wright",
      skills: [lineCook._id],
      desiredWeeklyHours: 40,
      locations: [midtownNYC._id],
    },
    {
      firstName: "Sophia",
      lastName: "Martinez",
      skills: [server._id, host._id],
      desiredWeeklyHours: 22,
      locations: [midtownNYC._id],
    },
    {
      firstName: "Liam",
      lastName: "Garcia",
      skills: [barback._id],
      desiredWeeklyHours: 18,
      locations: [midtownNYC._id, brooklynHeights._id],
    },
    {
      firstName: "Ava",
      lastName: "Robinson",
      skills: [server._id],
      desiredWeeklyHours: 26,
      locations: [brooklynHeights._id],
    },
    {
      firstName: "Noah",
      lastName: "Clark",
      skills: [lineCook._id, dishwasher._id],
      desiredWeeklyHours: 32,
      locations: [brooklynHeights._id],
    },
    {
      firstName: "Isabella",
      lastName: "Lewis",
      skills: [bartender._id, host._id],
      desiredWeeklyHours: 24,
      locations: [brooklynHeights._id],
    },
    // certified at both an LA and NYC location — exercises the per-location availability decision
    {
      firstName: "Grace",
      lastName: "Walker",
      skills: [server._id, bartender._id],
      desiredWeeklyHours: 20,
      locations: [santaMonica._id, midtownNYC._id],
    },
  ];

  const staff: SeededUser[] = [];
  const staffDocs: Record<string, mongoose.Types.ObjectId[]> = {};

  for (const def of staffDefs) {
    const email = `${def.firstName.toLowerCase()}.${def.lastName.toLowerCase()}@coastaleats.com`;
    const user = await UserModel.create({
      email,
      passwordHash,
      role: Role.Staff,
      firstName: def.firstName,
      lastName: def.lastName,
      skillIds: def.skills,
      desiredWeeklyHours: def.desiredWeeklyHours,
      managedLocationIds: [],
    });
    staff.push({ id: user._id, email, role: Role.Staff });
    staffDocs[email] = def.locations;

    for (const locationId of def.locations) {
      await CertificationModel.create({
        staffId: user._id,
        locationId,
        certifiedAt: DateTime.now().minus({ months: 6 }).toJSDate(),
        revokedAt: null,
        revokedReason: null,
      });
    }

    await AvailabilityModel.create([
      {
        staffId: user._id,
        type: AvailabilityType.Recurring,
        dayOfWeek: 1,
        startLocalTime: "09:00",
        endLocalTime: "17:00",
      },
      {
        staffId: user._id,
        type: AvailabilityType.Recurring,
        dayOfWeek: 3,
        startLocalTime: "09:00",
        endLocalTime: "17:00",
      },
      {
        staffId: user._id,
        type: AvailabilityType.Recurring,
        dayOfWeek: 5,
        startLocalTime: "16:00",
        endLocalTime: "23:59",
      },
      {
        staffId: user._id,
        type: AvailabilityType.Recurring,
        dayOfWeek: 6,
        startLocalTime: "16:00",
        endLocalTime: "23:59",
      },
    ]);
  }

  credentials.push({
    email: staff[0].email,
    role: "staff",
    note: "Bartender at Downtown LA, near weekly OT threshold this week",
  });
  credentials.push({
    email: "grace.walker@coastaleats.com",
    role: "staff",
    note: "Certified at Santa Monica (PT) and Midtown NYC (ET) — exercises cross-timezone availability",
  });

  for (const person of [
    admin,
    managerLA,
    managerNYC,
    managerMixed,
    ...staff.map((s) => ({ _id: s.id, email: s.email })),
  ]) {
    await NotificationPreferenceModel.create({
      userId: person._id,
      emailSimEnabled: Math.random() > 0.6,
      mutedTypes: [],
    });
  }

  const findStaff = (email: string) => staff.find((s) => s.email === email)!;
  const sarah = findStaff("sarah.chen@coastaleats.com");
  const john = findStaff("john.diaz@coastaleats.com");
  const maria = findStaff("maria.lopez@coastaleats.com");
  const chris = findStaff("chris.evans@coastaleats.com");
  const david = findStaff("david.kim@coastaleats.com");
  const olivia = findStaff("olivia.brown@coastaleats.com");
  const ethan = findStaff("ethan.wright@coastaleats.com");
  const sophia = findStaff("sophia.martinez@coastaleats.com");
  const ava = findStaff("ava.robinson@coastaleats.com");
  const noah = findStaff("noah.clark@coastaleats.com");
  const isabella = findStaff("isabella.lewis@coastaleats.com");
  const grace = findStaff("grace.walker@coastaleats.com");
  const priya = findStaff("priya.shah@coastaleats.com");
  const marcus = findStaff("marcus.johnson@coastaleats.com");
  const emily = findStaff("emily.white@coastaleats.com");

  const now = DateTime.now().setZone("America/Los_Angeles");
  const currentMonday = now.set({ weekday: 1, hour: 0, minute: 0, second: 0, millisecond: 0 });

  async function createShiftDirect(opts: {
    location: typeof downtownLA;
    requiredSkillId: mongoose.Types.ObjectId;
    startUtc: Date;
    endUtc: Date;
    headcount: number;
    status: ShiftStatus;
    createdBy: mongoose.Types.ObjectId;
  }) {
    const weekKey = computeWeekKey(opts.startUtc, opts.location.timezone);
    const isPremium = computeIsPremium(opts.startUtc, opts.location.timezone);
    const shift = await ShiftModel.create({
      locationId: opts.location._id,
      requiredSkillId: opts.requiredSkillId,
      startUtc: opts.startUtc,
      endUtc: opts.endUtc,
      headcount: opts.headcount,
      status: opts.status,
      weekKey,
      isPremium,
      version: 0,
      createdBy: opts.createdBy,
      updatedBy: opts.createdBy,
    });
    await AuditLogModel.create({
      entityType: AuditEntityType.Shift,
      entityId: shift._id,
      action: AuditAction.Create,
      performedBy: opts.createdBy,
      before: null,
      after: shift.toObject(),
      locationId: opts.location._id,
      timestamp: shift.createdAt,
    });
    if (opts.status === ShiftStatus.Published) {
      await AuditLogModel.create({
        entityType: AuditEntityType.Shift,
        entityId: shift._id,
        action: AuditAction.Publish,
        performedBy: opts.createdBy,
        before: { status: ShiftStatus.Draft },
        after: { status: ShiftStatus.Published },
        locationId: opts.location._id,
        timestamp: shift.createdAt,
      });
    }
    return shift;
  }

  async function notify(opts: {
    userId: mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    body: string;
    relatedEntityType?: string;
    relatedEntityId?: mongoose.Types.ObjectId;
    readAt?: Date | null;
    createdAt?: Date;
  }) {
    const doc = await NotificationModel.create({
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      relatedEntityType: opts.relatedEntityType ?? null,
      relatedEntityId: opts.relatedEntityId ?? null,
      readAt: opts.readAt ?? null,
      channel: NotificationChannel.InApp,
    });
    if (opts.createdAt) {
      await NotificationModel.updateOne({ _id: doc._id }, { createdAt: opts.createdAt });
    }
    return doc;
  }

  async function assignDirect(
    shiftId: mongoose.Types.ObjectId,
    staffId: mongoose.Types.ObjectId,
    assignedBy: mongoose.Types.ObjectId,
    locationId: mongoose.Types.ObjectId
  ) {
    const assignment = await AssignmentModel.create({
      shiftId,
      staffId,
      status: AssignmentStatus.Active,
      version: 0,
      assignedBy,
      assignedAt: new Date(),
    });
    await AuditLogModel.create({
      entityType: AuditEntityType.Assignment,
      entityId: assignment._id,
      action: AuditAction.Create,
      performedBy: assignedBy,
      before: null,
      after: assignment.toObject(),
      locationId,
      timestamp: assignment.assignedAt,
    });
    return assignment;
  }

  // dayOfWeek follows the same convention as Availability.dayOfWeek: 0=Sunday..6=Saturday,
  // relative to the current week unless weekOffset shifts to a prior/future week.
  // currentMonday has luxon weekday=1 (Monday), so Sunday of that same week is one day earlier.
  function laDay(dayOfWeek: number, hour: number, minute = 0, weekOffset = 0): Date {
    const mondayOffset = dayOfWeek === 0 ? -1 : dayOfWeek - 1;
    return currentMonday
      .plus({ weeks: weekOffset, days: mondayOffset })
      .set({ hour, minute })
      .toUTC()
      .toJSDate();
  }

  // Timezone-aware equivalent of laDay: computes "this week's Monday" fresh in the
  // given zone (rather than converting a Pacific-anchored Monday), so it's correct
  // even when the two zones' local calendar dates diverge near a day boundary.
  function weekDay(
    timezone: string,
    dayOfWeek: number,
    hour: number,
    minute = 0,
    weekOffset = 0
  ): Date {
    const zoneNow = DateTime.now().setZone(timezone);
    const zoneMonday = zoneNow.set({ weekday: 1, hour: 0, minute: 0, second: 0, millisecond: 0 });
    const mondayOffset = dayOfWeek === 0 ? -1 : dayOfWeek - 1;
    return zoneMonday
      .plus({ weeks: weekOffset, days: mondayOffset })
      .set({ hour, minute })
      .toUTC()
      .toJSDate();
  }

  // Overnight shift: Friday 11pm - Saturday 3am at Downtown LA
  const overnightShift = await createShiftDirect({
    location: downtownLA,
    requiredSkillId: bartender._id,
    startUtc: laDay(5, 23, 0),
    endUtc: laDay(6, 3, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerLA._id,
  });
  await assignDirect(overnightShift._id, sarah.id, managerLA._id, downtownLA._id);

  // Sarah past the 40h weekly threshold once combined with her Friday overnight shift:
  // 5 x 8h weekday shifts (Mon-Fri) + the 4h overnight shift above = 44h this week.
  // Her Friday day shift (ends 6pm) and the Friday overnight shift (starts 11pm) also
  // leave only 5 hours of rest — an intentional pre-existing min-rest violation, seeded
  // directly (bypassing the constraint engine) to model a real conflict a manager would
  // discover on the shift's history/audit view rather than a bug in this script.
  for (let day = 1; day <= 5; day++) {
    const shift = await createShiftDirect({
      location: downtownLA,
      requiredSkillId: bartender._id,
      startUtc: laDay(day, 10, 0),
      endUtc: laDay(day, 18, 0),
      headcount: 1,
      status: ShiftStatus.Published,
      createdBy: managerLA._id,
    });
    await assignDirect(shift._id, sarah.id, managerLA._id, downtownLA._id);
  }

  // Chris Evans: 6 consecutive days worked (Mon-Sat), demonstrates the 6th-day warning
  for (let day = 1; day <= 6; day++) {
    const shift = await createShiftDirect({
      location: downtownLA,
      requiredSkillId: lineCook._id,
      startUtc: laDay(day, 11, 0),
      endUtc: laDay(day, 15, 0),
      headcount: 1,
      status: ShiftStatus.Published,
      createdBy: managerLA._id,
    });
    await assignDirect(shift._id, chris.id, managerLA._id, downtownLA._id);
  }

  // A pending swap request: John's Saturday evening shift, offered to Maria
  const johnShift = await createShiftDirect({
    location: downtownLA,
    requiredSkillId: bartender._id,
    startUtc: laDay(6, 18, 0),
    endUtc: laDay(6, 23, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerLA._id,
  });
  const johnAssignment = await assignDirect(johnShift._id, john.id, managerLA._id, downtownLA._id);
  const johnSwap = await SwapRequestModel.create({
    type: SwapType.Swap,
    assignmentId: johnAssignment._id,
    requestedBy: john.id,
    targetStaffId: maria.id,
    status: SwapStatus.PendingTargetAcceptance,
  });
  await notify({
    userId: maria.id,
    type: NotificationType.SwapRequested,
    title: "Shift swap requested",
    body: "John Diaz wants to swap his Saturday evening bartender shift with you.",
    relatedEntityType: "swap_request",
    relatedEntityId: johnSwap._id,
    createdAt: DateTime.now().minus({ hours: 5 }).toJSDate(),
  });

  // Santa Monica current-week published schedule (Pacific time)
  const priyaShift = await createShiftDirect({
    location: santaMonica,
    requiredSkillId: lineCook._id,
    startUtc: laDay(1, 10, 0),
    endUtc: laDay(1, 18, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerLA._id,
  });
  await assignDirect(priyaShift._id, priya.id, managerLA._id, santaMonica._id);

  const marcusShift = await createShiftDirect({
    location: santaMonica,
    requiredSkillId: server._id,
    startUtc: laDay(3, 11, 0),
    endUtc: laDay(3, 17, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerLA._id,
  });
  await assignDirect(marcusShift._id, marcus.id, managerLA._id, santaMonica._id);

  // Premium (Fri/Sat evening) shift at Santa Monica, for fairness-analytics coverage
  const emilySaturday = await createShiftDirect({
    location: santaMonica,
    requiredSkillId: server._id,
    startUtc: laDay(6, 17, 0),
    endUtc: laDay(6, 22, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerLA._id,
  });
  await assignDirect(emilySaturday._id, emily.id, managerLA._id, santaMonica._id);

  // An unfilled (unassigned) shift at Santa Monica, to demonstrate the assignment flow live
  await createShiftDirect({
    location: santaMonica,
    requiredSkillId: host._id,
    startUtc: laDay(2, 12, 0),
    endUtc: laDay(2, 20, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerLA._id,
  });

  // A drop request expiring ~2 hours after seed run (close-to-expiry demo case)
  const soonShift = await createShiftDirect({
    location: santaMonica,
    requiredSkillId: dishwasher._id,
    startUtc: DateTime.now().plus({ hours: 26 }).toUTC().toJSDate(),
    endUtc: DateTime.now().plus({ hours: 30 }).toUTC().toJSDate(),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerLA._id,
  });
  const davidAssignment = await assignDirect(
    soonShift._id,
    david.id,
    managerLA._id,
    santaMonica._id
  );
  const davidDrop = await SwapRequestModel.create({
    type: SwapType.Drop,
    assignmentId: davidAssignment._id,
    requestedBy: david.id,
    status: SwapStatus.PendingClaim,
    expiresAt: DateTime.now().plus({ hours: 2 }).toUTC().toJSDate(),
  });
  for (const staffMember of [priya, marcus, emily]) {
    await notify({
      userId: staffMember.id,
      type: NotificationType.DropAvailable,
      title: "Open shift available to claim",
      body: "A dishwasher shift at Santa Monica was dropped and is open for claim (expires in 2 hours).",
      relatedEntityType: "swap_request",
      relatedEntityId: davidDrop._id,
      createdAt: DateTime.now().minus({ hours: 3 }).toJSDate(),
    });
  }

  // A denied historical swap for audit-log richness (last week, Wednesday)
  const pastShift = await createShiftDirect({
    location: downtownLA,
    requiredSkillId: server._id,
    startUtc: laDay(3, 10, 0, -1),
    endUtc: laDay(3, 16, 0, -1),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerLA._id,
  });
  const pastAssignment = await assignDirect(pastShift._id, maria.id, managerLA._id, downtownLA._id);
  const deniedSwap = await SwapRequestModel.create({
    type: SwapType.Drop,
    assignmentId: pastAssignment._id,
    requestedBy: maria.id,
    status: SwapStatus.Denied,
    managerDecisionBy: managerLA._id,
    managerDecisionAt: DateTime.now().minus({ days: 6 }).toJSDate(),
    managerDecisionReason: "No qualified coverage available that evening",
  });
  await AuditLogModel.create({
    entityType: AuditEntityType.SwapRequest,
    entityId: deniedSwap._id,
    action: AuditAction.Deny,
    performedBy: managerLA._id,
    before: { status: SwapStatus.PendingManagerApproval },
    after: { status: SwapStatus.Denied, reason: deniedSwap.managerDecisionReason },
    locationId: downtownLA._id,
    timestamp: deniedSwap.managerDecisionAt!,
  });
  await notify({
    userId: maria.id,
    type: NotificationType.SwapResolved,
    title: "Swap request denied",
    body: "Your drop request was denied: No qualified coverage available that evening.",
    relatedEntityType: "swap_request",
    relatedEntityId: deniedSwap._id,
    readAt: DateTime.now().minus({ days: 5 }).toJSDate(),
    createdAt: deniedSwap.managerDecisionAt!,
  });

  await notify({
    userId: sarah.id,
    type: NotificationType.OvertimeWarning,
    title: "Approaching weekly overtime",
    body: "Your scheduled hours this week (44h) exceed the standard 40h threshold at Downtown LA.",
    relatedEntityType: "user",
    relatedEntityId: sarah.id,
    createdAt: DateTime.now().minus({ hours: 12 }).toJSDate(),
  });
  await notify({
    userId: managerLA._id,
    type: NotificationType.OvertimeWarning,
    title: "Staff approaching overtime",
    body: "Sarah Chen is scheduled for 44h this week at Downtown LA, above the standard 40h threshold.",
    relatedEntityType: "user",
    relatedEntityId: sarah.id,
    createdAt: DateTime.now().minus({ hours: 12 }).toJSDate(),
  });

  await notify({
    userId: managerLA._id,
    type: NotificationType.ApprovalNeeded,
    title: "Swap awaiting your approval",
    body: "John Diaz and Maria Lopez have a pending shift swap that needs manager review.",
    relatedEntityType: "swap_request",
    relatedEntityId: johnSwap._id,
    createdAt: DateTime.now().minus({ hours: 4 }).toJSDate(),
  });

  // Revoked-then-recertified staff/location pair (ambiguity #1 demo)
  const oldCert = await CertificationModel.findOne({
    staffId: david.id,
    locationId: downtownLA._id,
  });
  if (oldCert) {
    const before = oldCert.toObject();
    oldCert.revokedAt = DateTime.now().minus({ months: 2 }).toJSDate();
    oldCert.revokedReason = "Transferred to Santa Monica location";
    await oldCert.save();
    await AuditLogModel.create({
      entityType: AuditEntityType.Certification,
      entityId: oldCert._id,
      action: AuditAction.Revoke,
      performedBy: managerLA._id,
      before,
      after: oldCert.toObject(),
      locationId: downtownLA._id,
      timestamp: oldCert.revokedAt,
    });
  }
  const newCert = await CertificationModel.create({
    staffId: david.id,
    locationId: downtownLA._id,
    certifiedAt: DateTime.now().minus({ weeks: 2 }).toJSDate(),
    revokedAt: null,
    revokedReason: null,
  });
  await AuditLogModel.create({
    entityType: AuditEntityType.Certification,
    entityId: newCert._id,
    action: AuditAction.Create,
    performedBy: managerLA._id,
    before: null,
    after: newCert.toObject(),
    locationId: downtownLA._id,
    timestamp: newCert.certifiedAt,
  });

  // Midtown NYC current-week published schedule (Eastern time)
  const oliviaMonWed = await createShiftDirect({
    location: midtownNYC,
    requiredSkillId: bartender._id,
    startUtc: weekDay(midtownNYC.timezone, 1, 17, 0),
    endUtc: weekDay(midtownNYC.timezone, 1, 23, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerNYC._id,
  });
  await assignDirect(oliviaMonWed._id, olivia.id, managerNYC._id, midtownNYC._id);

  const ethanShift = await createShiftDirect({
    location: midtownNYC,
    requiredSkillId: lineCook._id,
    startUtc: weekDay(midtownNYC.timezone, 2, 10, 0),
    endUtc: weekDay(midtownNYC.timezone, 2, 18, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerNYC._id,
  });
  await assignDirect(ethanShift._id, ethan.id, managerNYC._id, midtownNYC._id);

  // Premium (Fri/Sat evening) shift at Midtown NYC, for fairness-analytics coverage
  const sophiaFriday = await createShiftDirect({
    location: midtownNYC,
    requiredSkillId: server._id,
    startUtc: weekDay(midtownNYC.timezone, 5, 18, 0),
    endUtc: weekDay(midtownNYC.timezone, 5, 23, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerNYC._id,
  });
  await assignDirect(sophiaFriday._id, sophia.id, managerNYC._id, midtownNYC._id);

  // Brooklyn Heights current-week published schedule (Eastern time)
  const avaShift = await createShiftDirect({
    location: brooklynHeights,
    requiredSkillId: server._id,
    startUtc: weekDay(brooklynHeights.timezone, 2, 11, 0),
    endUtc: weekDay(brooklynHeights.timezone, 2, 19, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerNYC._id,
  });
  await assignDirect(avaShift._id, ava.id, managerNYC._id, brooklynHeights._id);

  const noahShift = await createShiftDirect({
    location: brooklynHeights,
    requiredSkillId: lineCook._id,
    startUtc: weekDay(brooklynHeights.timezone, 4, 10, 0),
    endUtc: weekDay(brooklynHeights.timezone, 4, 18, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerNYC._id,
  });
  await assignDirect(noahShift._id, noah.id, managerNYC._id, brooklynHeights._id);

  // Premium (Fri/Sat evening) shift at Brooklyn Heights, for fairness-analytics coverage
  const isabellaSaturday = await createShiftDirect({
    location: brooklynHeights,
    requiredSkillId: bartender._id,
    startUtc: weekDay(brooklynHeights.timezone, 6, 18, 0),
    endUtc: weekDay(brooklynHeights.timezone, 6, 23, 30),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerNYC._id,
  });
  await assignDirect(isabellaSaturday._id, isabella.id, managerNYC._id, brooklynHeights._id);

  // An unfilled (unassigned) shift at Brooklyn Heights, to demonstrate the assignment flow live
  await createShiftDirect({
    location: brooklynHeights,
    requiredSkillId: host._id,
    startUtc: weekDay(brooklynHeights.timezone, 3, 12, 0),
    endUtc: weekDay(brooklynHeights.timezone, 3, 20, 0),
    headcount: 1,
    status: ShiftStatus.Published,
    createdBy: managerNYC._id,
  });

  // Next week's draft schedule for a couple of shifts
  const nextMonday = currentMonday.plus({ weeks: 1 });
  await createShiftDirect({
    location: midtownNYC,
    requiredSkillId: bartender._id,
    startUtc: nextMonday.plus({ days: 4, hours: 18 }).toUTC().toJSDate(),
    endUtc: nextMonday.plus({ days: 4, hours: 23 }).toUTC().toJSDate(),
    headcount: 1,
    status: ShiftStatus.Draft,
    createdBy: managerNYC._id,
  });

  const scheduleAssignedNotifications: Array<{
    staffId: mongoose.Types.ObjectId;
    locationName: string;
    read: boolean;
  }> = [
    { staffId: olivia.id, locationName: "Midtown NYC", read: true },
    { staffId: ethan.id, locationName: "Midtown NYC", read: true },
    { staffId: sophia.id, locationName: "Midtown NYC", read: false },
    { staffId: ava.id, locationName: "Brooklyn Heights", read: false },
    { staffId: noah.id, locationName: "Brooklyn Heights", read: true },
    { staffId: isabella.id, locationName: "Brooklyn Heights", read: false },
    { staffId: priya.id, locationName: "Santa Monica", read: true },
    { staffId: marcus.id, locationName: "Santa Monica", read: false },
    { staffId: emily.id, locationName: "Santa Monica", read: false },
  ];
  for (const entry of scheduleAssignedNotifications) {
    const createdAt = DateTime.now().minus({ days: 2 }).toJSDate();
    await notify({
      userId: entry.staffId,
      type: NotificationType.SchedulePublished,
      title: "Schedule published",
      body: `This week's schedule at ${entry.locationName} has been published.`,
      relatedEntityType: "shift",
      readAt: entry.read ? DateTime.now().minus({ days: 1 }).toJSDate() : null,
      createdAt,
    });
  }

  // Downtown LA schedule-published notifications, matching the NYC/Brooklyn/Santa Monica batch above
  await notify({
    userId: sarah.id,
    type: NotificationType.SchedulePublished,
    title: "Schedule published",
    body: "This week's schedule at Downtown LA has been published.",
    relatedEntityType: "shift",
    readAt: DateTime.now().minus({ days: 1 }).toJSDate(),
    createdAt: DateTime.now().minus({ days: 2 }).toJSDate(),
  });
  await notify({
    userId: chris.id,
    type: NotificationType.SchedulePublished,
    title: "Schedule published",
    body: "This week's schedule at Downtown LA has been published.",
    relatedEntityType: "shift",
    createdAt: DateTime.now().minus({ days: 2 }).toJSDate(),
  });
  await notify({
    userId: maria.id,
    type: NotificationType.SchedulePublished,
    title: "Schedule published",
    body: "This week's schedule at Downtown LA has been published.",
    relatedEntityType: "shift",
    createdAt: DateTime.now().minus({ days: 2 }).toJSDate(),
  });

  // Shift assigned: fires whenever a manager places someone on a new shift
  await notify({
    userId: sarah.id,
    type: NotificationType.ShiftAssigned,
    title: "You've been assigned a new shift",
    body: "You were assigned a Friday overnight bartender shift at Downtown LA.",
    relatedEntityType: "shift",
    relatedEntityId: overnightShift._id,
    createdAt: DateTime.now().minus({ days: 3 }).toJSDate(),
  });
  await notify({
    userId: david.id,
    type: NotificationType.ShiftAssigned,
    title: "You've been assigned a new shift",
    body: "You were assigned a dishwasher shift at Santa Monica.",
    relatedEntityType: "shift",
    relatedEntityId: soonShift._id,
    createdAt: DateTime.now().minus({ days: 1 }).toJSDate(),
  });

  // Shift changed: a manager edited the time/headcount on a published shift after assignment
  await notify({
    userId: olivia.id,
    type: NotificationType.ShiftChanged,
    title: "Shift details updated",
    body: "Your Monday bartender shift at Midtown NYC had its headcount updated by your manager.",
    relatedEntityType: "shift",
    relatedEntityId: oliviaMonWed._id,
    readAt: DateTime.now().minus({ hours: 20 }).toJSDate(),
    createdAt: DateTime.now().minus({ days: 1 }).toJSDate(),
  });

  // Shift unassigned: staff removed from a shift they were previously on
  await notify({
    userId: marcus.id,
    type: NotificationType.ShiftUnassigned,
    title: "Removed from a shift",
    body: "You were removed from Wednesday's server shift at Santa Monica.",
    relatedEntityType: "shift",
    relatedEntityId: marcusShift._id,
    createdAt: DateTime.now().minus({ hours: 30 }).toJSDate(),
  });

  // Availability changed: a staff member updated their recurring availability
  await notify({
    userId: managerLA._id,
    type: NotificationType.AvailabilityChanged,
    title: "Staff availability updated",
    body: "John Diaz updated his weekly availability at Downtown LA.",
    relatedEntityType: "user",
    relatedEntityId: john.id,
    createdAt: DateTime.now().minus({ hours: 18 }).toJSDate(),
  });
  await notify({
    userId: managerMixed._id,
    type: NotificationType.AvailabilityChanged,
    title: "Staff availability updated",
    body: "Grace Walker updated her weekly availability at Santa Monica.",
    relatedEntityType: "user",
    relatedEntityId: grace.id,
    createdAt: DateTime.now().minus({ hours: 10 }).toJSDate(),
  });

  // Cross-manager coverage so every manager account has at least one notification
  await notify({
    userId: managerNYC._id,
    type: NotificationType.OvertimeWarning,
    title: "Staff approaching overtime",
    body: "Ethan Wright is trending toward 40h this week at Midtown NYC.",
    relatedEntityType: "user",
    relatedEntityId: ethan.id,
    createdAt: DateTime.now().minus({ hours: 6 }).toJSDate(),
  });

  // Admin: cross-location visibility notifications, so the admin account isn't empty
  await notify({
    userId: admin._id,
    type: NotificationType.OvertimeWarning,
    title: "Staff approaching overtime",
    body: "Sarah Chen is scheduled for 44h this week at Downtown LA, above the standard 40h threshold.",
    relatedEntityType: "user",
    relatedEntityId: sarah.id,
    createdAt: DateTime.now().minus({ hours: 12 }).toJSDate(),
  });
  await notify({
    userId: admin._id,
    type: NotificationType.ApprovalNeeded,
    title: "Swap awaiting manager approval",
    body: "John Diaz and Maria Lopez have a pending shift swap at Downtown LA awaiting review.",
    relatedEntityType: "swap_request",
    relatedEntityId: johnSwap._id,
    createdAt: DateTime.now().minus({ hours: 4 }).toJSDate(),
  });
  await notify({
    userId: admin._id,
    type: NotificationType.SwapResolved,
    title: "Swap request denied",
    body: "Maria Lopez's drop request at Downtown LA was denied by Jordan Kim.",
    relatedEntityType: "swap_request",
    relatedEntityId: deniedSwap._id,
    readAt: DateTime.now().minus({ days: 5 }).toJSDate(),
    createdAt: deniedSwap.managerDecisionAt!,
  });
  await notify({
    userId: admin._id,
    type: NotificationType.SchedulePublished,
    title: "Schedule published",
    body: "This week's schedule was published across all 4 locations.",
    relatedEntityType: "shift",
    readAt: DateTime.now().minus({ days: 1 }).toJSDate(),
    createdAt: DateTime.now().minus({ days: 2 }).toJSDate(),
  });

  console.log("\nSeed complete.\n");
  console.log(`Seeded password for all accounts: ${env.seedPassword}\n`);
  console.log("Demo credentials:");
  for (const cred of credentials) {
    console.log(`  [${cred.role.padEnd(8)}] ${cred.email.padEnd(35)} ${cred.note}`);
  }
  console.log(`\nTotal staff seeded: ${staff.length}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
