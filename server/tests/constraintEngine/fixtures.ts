import { Types } from "mongoose";
import { AssignmentStatus, AvailabilityType, Role, ShiftStatus } from "@shiftsync/shared";
import { AssignmentDocument } from "../../src/models/Assignment";
import { AvailabilityDocument } from "../../src/models/Availability";
import { CertificationDocument } from "../../src/models/Certification";
import { LocationDocument } from "../../src/models/Location";
import { ShiftDocument } from "../../src/models/Shift";
import { UserDocument } from "../../src/models/User";
import { AssignmentWithShift, EvaluationContext } from "../../src/constraintEngine/types";
import { computeWeekKey } from "../../src/time/tz";
import { computeIsPremium } from "../../src/models/Shift";

function oid(): Types.ObjectId {
  return new Types.ObjectId();
}

export function makeLocation(overrides: Partial<LocationDocument> = {}): LocationDocument {
  return {
    _id: oid(),
    id: undefined,
    name: "Test Location",
    timezone: "America/New_York",
    address: null,
    isActive: true,
    ...overrides,
  } as unknown as LocationDocument;
}

export function makeUser(overrides: Partial<UserDocument> = {}): UserDocument {
  const _id = oid();
  return {
    _id,
    id: _id.toString(),
    email: "staff@example.com",
    passwordHash: "x",
    role: Role.Staff,
    firstName: "Test",
    lastName: "Staff",
    isActive: true,
    managedLocationIds: [],
    skillIds: [],
    desiredWeeklyHours: null,
    refreshTokenHash: null,
    ...overrides,
  } as unknown as UserDocument;
}

export function makeShift(
  location: LocationDocument,
  overrides: Partial<{ startUtc: Date; endUtc: Date; requiredSkillId: Types.ObjectId }> = {}
): ShiftDocument {
  const _id = oid();
  const startUtc = overrides.startUtc ?? new Date("2026-09-04T21:00:00.000Z");
  const endUtc = overrides.endUtc ?? new Date("2026-09-05T05:00:00.000Z");
  return {
    _id,
    id: _id.toString(),
    locationId: location._id,
    requiredSkillId: overrides.requiredSkillId ?? oid(),
    startUtc,
    endUtc,
    headcount: 1,
    status: ShiftStatus.Published,
    weekKey: computeWeekKey(startUtc, location.timezone),
    notes: null,
    version: 0,
    isPremium: computeIsPremium(startUtc, location.timezone),
    createdBy: oid(),
    updatedBy: oid(),
  } as unknown as ShiftDocument;
}

export function makeAssignment(
  shift: ShiftDocument,
  staff: UserDocument,
  overrides: Partial<AssignmentDocument> = {}
): AssignmentDocument {
  const _id = oid();
  return {
    _id,
    id: _id.toString(),
    shiftId: shift._id,
    staffId: staff._id,
    status: AssignmentStatus.Active,
    version: 0,
    assignedBy: oid(),
    assignedAt: new Date(),
    releasedAt: null,
    releasedReason: null,
    ...overrides,
  } as unknown as AssignmentDocument;
}

export function makeAvailability(
  staff: UserDocument,
  overrides: Partial<AvailabilityDocument>
): AvailabilityDocument {
  const _id = oid();
  return {
    _id,
    id: _id.toString(),
    staffId: staff._id,
    type: AvailabilityType.Recurring,
    dayOfWeek: null,
    startLocalTime: null,
    endLocalTime: null,
    exceptionDate: null,
    exceptionStartLocalTime: null,
    exceptionEndLocalTime: null,
    isUnavailable: false,
    ...overrides,
  } as unknown as AvailabilityDocument;
}

export function makeCertification(
  staff: UserDocument,
  location: LocationDocument,
  overrides: Partial<CertificationDocument> = {}
): CertificationDocument {
  const _id = oid();
  return {
    _id,
    id: _id.toString(),
    staffId: staff._id,
    locationId: location._id,
    certifiedAt: new Date("2020-01-01T00:00:00.000Z"),
    revokedAt: null,
    revokedReason: null,
    ...overrides,
  } as unknown as CertificationDocument;
}

export interface BuildContextInput {
  staff: UserDocument;
  shift: ShiftDocument;
  location: LocationDocument;
  activeAssignments?: AssignmentWithShift[];
  otherLocations?: LocationDocument[];
  certifications?: CertificationDocument[];
  availability?: AvailabilityDocument[];
  allowManagerOverride?: boolean;
  overrideReason?: string | null;
}

export function buildContext(input: BuildContextInput): EvaluationContext {
  const locationsById = new Map<string, LocationDocument>();
  locationsById.set(input.location._id.toString(), input.location);
  for (const loc of input.otherLocations ?? []) {
    locationsById.set(loc._id.toString(), loc);
  }
  for (const { shift } of input.activeAssignments ?? []) {
    if (!locationsById.has(shift.locationId.toString())) {
      locationsById.set(shift.locationId.toString(), input.location);
    }
  }

  return {
    staff: input.staff,
    shift: input.shift,
    location: input.location,
    activeAssignments: input.activeAssignments ?? [],
    locationsById,
    certifications: input.certifications ?? [],
    availability: input.availability ?? [],
    allowManagerOverride: input.allowManagerOverride ?? false,
    overrideReason: input.overrideReason ?? null,
  };
}
