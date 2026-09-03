import { AssignmentStatus, Role } from "@shiftsync/shared";
import { AssignmentModel } from "../../models/Assignment";
import { ShiftModel, ShiftDocument } from "../../models/Shift";
import { UserModel } from "../../models/User";

const BASE_HOURLY_RATE = 18;
const OT_MULTIPLIER = 1.5;
const OT_WEEKLY_THRESHOLD_HOURS = 40;
const WEEKLY_WARN_HOURS = 35;

function shiftHours(shift: ShiftDocument): number {
  return (shift.endUtc.getTime() - shift.startUtc.getTime()) / (1000 * 60 * 60);
}

async function activeShiftsForStaffInWeek(
  staffIds: string[],
  weekKey: string
): Promise<Map<string, ShiftDocument[]>> {
  const assignments = await AssignmentModel.find({
    staffId: { $in: staffIds },
    status: AssignmentStatus.Active,
  });
  const shiftIds = assignments.map((a) => a.shiftId);
  const shifts = await ShiftModel.find({ _id: { $in: shiftIds }, weekKey });
  const shiftsById = new Map(shifts.map((s) => [s.id.toString(), s]));

  const result = new Map<string, ShiftDocument[]>();
  for (const staffId of staffIds) result.set(staffId, []);
  for (const assignment of assignments) {
    const shift = shiftsById.get(assignment.shiftId.toString());
    if (!shift) continue;
    result.get(assignment.staffId.toString())?.push(shift);
  }
  return result;
}

export interface HoursDistributionEntry {
  staffId: string;
  name: string;
  totalHours: number;
  premiumHours: number;
}

export async function hoursDistribution(
  locationId: string | undefined,
  weekKey: string
): Promise<HoursDistributionEntry[]> {
  const staff = await UserModel.find({ isActive: true, role: Role.Staff });
  const staffIds = staff.map((s) => s.id.toString());
  const shiftsByStaff = await activeShiftsForStaffInWeek(staffIds, weekKey);

  return staff.map((s) => {
    const shifts = (shiftsByStaff.get(s.id.toString()) ?? []).filter(
      (sh) => !locationId || sh.locationId.toString() === locationId
    );
    const totalHours = shifts.reduce((sum, sh) => sum + shiftHours(sh), 0);
    const premiumHours = shifts
      .filter((sh) => sh.isPremium)
      .reduce((sum, sh) => sum + shiftHours(sh), 0);
    return {
      staffId: s.id.toString(),
      name: `${s.firstName} ${s.lastName}`,
      totalHours,
      premiumHours,
    };
  });
}

export interface FairnessEntry {
  staffId: string;
  name: string;
  premiumHours: number;
}

export interface FairnessReport {
  entries: FairnessEntry[];
  equityScore: number;
  formula: string;
}

/**
 * Equity score = 100 * (1 - coefficient of variation of premium hours across
 * staff), floored at 0. Coefficient of variation (stddev / mean) is a
 * standard dispersion measure that is scale-invariant, so it stays
 * meaningful whether staff work a handful of premium hours or dozens — a
 * simple max/min ratio breaks down whenever any staff member has zero
 * premium hours.
 */
export async function fairnessReport(
  locationId: string | undefined,
  weekKey: string
): Promise<FairnessReport> {
  const staff = await UserModel.find({ isActive: true, role: Role.Staff });
  const staffIds = staff.map((s) => s.id.toString());
  const shiftsByStaff = await activeShiftsForStaffInWeek(staffIds, weekKey);

  const entries: FairnessEntry[] = staff.map((s) => {
    const shifts = (shiftsByStaff.get(s.id.toString()) ?? []).filter(
      (sh) => !locationId || sh.locationId.toString() === locationId
    );
    const premiumHours = shifts
      .filter((sh) => sh.isPremium)
      .reduce((sum, sh) => sum + shiftHours(sh), 0);
    return { staffId: s.id.toString(), name: `${s.firstName} ${s.lastName}`, premiumHours };
  });

  const values = entries.map((e) => e.premiumHours);
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length || 1);
  const stddev = Math.sqrt(variance);
  const coefficientOfVariation = mean === 0 ? 0 : stddev / mean;
  const equityScore = Math.max(0, Math.min(100, 100 * (1 - coefficientOfVariation)));

  return {
    entries,
    equityScore,
    formula: "100 * (1 - stddev(premiumHours) / mean(premiumHours)), clamped to [0,100]",
  };
}

export interface UnderOverEntry {
  staffId: string;
  name: string;
  desiredWeeklyHours: number | null;
  actualHours: number;
  delta: number;
}

export async function underOverScheduled(
  locationId: string | undefined,
  weekKey: string
): Promise<UnderOverEntry[]> {
  const staff = await UserModel.find({ isActive: true, desiredWeeklyHours: { $ne: null } });
  const staffIds = staff.map((s) => s.id.toString());
  const shiftsByStaff = await activeShiftsForStaffInWeek(staffIds, weekKey);

  return staff.map((s) => {
    const shifts = (shiftsByStaff.get(s.id.toString()) ?? []).filter(
      (sh) => !locationId || sh.locationId.toString() === locationId
    );
    const actualHours = shifts.reduce((sum, sh) => sum + shiftHours(sh), 0);
    const desired = s.desiredWeeklyHours ?? 0;
    return {
      staffId: s.id.toString(),
      name: `${s.firstName} ${s.lastName}`,
      desiredWeeklyHours: s.desiredWeeklyHours,
      actualHours,
      delta: actualHours - desired,
    };
  });
}

export interface OtDashboardEntry {
  staffId: string;
  name: string;
  projectedWeeklyHours: number;
  projectedOvertimeHours: number;
  projectedOvertimeCost: number;
  status: "ok" | "warn" | "block";
}

export async function otDashboard(
  locationId: string | undefined,
  weekKey: string
): Promise<OtDashboardEntry[]> {
  const staff = await UserModel.find({ isActive: true, role: Role.Staff });
  const staffIds = staff.map((s) => s.id.toString());
  const shiftsByStaff = await activeShiftsForStaffInWeek(staffIds, weekKey);

  return staff.map((s) => {
    const shifts = (shiftsByStaff.get(s.id.toString()) ?? []).filter(
      (sh) => !locationId || sh.locationId.toString() === locationId
    );
    const projectedWeeklyHours = shifts.reduce((sum, sh) => sum + shiftHours(sh), 0);
    const otHours = Math.max(0, projectedWeeklyHours - OT_WEEKLY_THRESHOLD_HOURS);
    const regularHours = projectedWeeklyHours - otHours;
    const cost = regularHours * BASE_HOURLY_RATE + otHours * BASE_HOURLY_RATE * OT_MULTIPLIER;

    let status: OtDashboardEntry["status"] = "ok";
    if (otHours > 0) status = "warn";
    if (projectedWeeklyHours >= WEEKLY_WARN_HOURS && otHours === 0) status = "warn";

    return {
      staffId: s.id.toString(),
      name: `${s.firstName} ${s.lastName}`,
      projectedWeeklyHours,
      projectedOvertimeHours: otHours,
      projectedOvertimeCost: cost,
      status,
    };
  });
}

export interface OnDutyEntry {
  staffId: string;
  name: string;
  shiftId: string;
  startUtc: string;
  endUtc: string;
}

export async function onDutyNow(locationId: string): Promise<OnDutyEntry[]> {
  const now = new Date();
  const shifts = await ShiftModel.find({
    locationId,
    startUtc: { $lte: now },
    endUtc: { $gt: now },
  });
  const shiftIds = shifts.map((s) => s._id);
  const assignments = await AssignmentModel.find({
    shiftId: { $in: shiftIds },
    status: AssignmentStatus.Active,
  });

  const staffIds = assignments.map((a) => a.staffId);
  const staff = await UserModel.find({ _id: { $in: staffIds } });
  const staffById = new Map(staff.map((s) => [s.id.toString(), s]));
  const shiftsById = new Map(shifts.map((s) => [s.id.toString(), s]));

  return assignments
    .map((a) => {
      const s = staffById.get(a.staffId.toString());
      const shift = shiftsById.get(a.shiftId.toString());
      if (!s || !shift) return null;
      return {
        staffId: s.id.toString(),
        name: `${s.firstName} ${s.lastName}`,
        shiftId: shift.id.toString(),
        startUtc: shift.startUtc.toISOString(),
        endUtc: shift.endUtc.toISOString(),
      };
    })
    .filter((x): x is OnDutyEntry => x !== null);
}
