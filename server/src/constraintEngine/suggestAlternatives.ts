import { ClientSession } from "mongoose";
import { SuggestedAlternative } from "@shiftsync/shared";
import { CertificationModel } from "../models/Certification";
import { ShiftModel } from "../models/Shift";
import { UserModel } from "../models/User";
import { loadEvaluationContext } from "./loadContext";
import { runAllRules } from "./runRules";

const MAX_SUGGESTIONS = 5;

export async function suggestAlternatives(
  shiftId: string,
  excludeStaffId: string,
  session?: ClientSession
): Promise<SuggestedAlternative[]> {
  const shift = await ShiftModel.findById(shiftId).session(session ?? null);
  if (!shift) return [];

  const certifiedStaffIds = await CertificationModel.find({
    locationId: shift.locationId,
    revokedAt: null,
  })
    .session(session ?? null)
    .distinct("staffId");

  const candidates = await UserModel.find({
    _id: { $ne: excludeStaffId, $in: certifiedStaffIds },
    skillIds: shift.requiredSkillId,
    isActive: true,
  }).session(session ?? null);

  const scored: Array<{ staffId: string; name: string; warningCount: number; weeklyHours: number }> = [];

  for (const candidate of candidates) {
    const ctx = await loadEvaluationContext({
      staffId: candidate.id.toString(),
      shiftId,
      session,
    });
    const { violations, warnings } = runAllRules(ctx);
    if (violations.length > 0) continue;

    const weeklyHours = ctx.activeAssignments
      .filter((a) => a.shift.weekKey === ctx.shift.weekKey)
      .reduce((sum, a) => sum + (a.shift.endUtc.getTime() - a.shift.startUtc.getTime()) / (1000 * 60 * 60), 0);

    scored.push({
      staffId: candidate.id.toString(),
      name: `${candidate.firstName} ${candidate.lastName}`,
      warningCount: warnings.length,
      weeklyHours,
    });
  }

  scored.sort((a, b) => a.warningCount - b.warningCount || a.weeklyHours - b.weeklyHours);

  return scored.slice(0, MAX_SUGGESTIONS).map((c) => ({
    staffId: c.staffId,
    name: c.name,
    reason:
      c.warningCount === 0
        ? "No violations or warnings; qualified and available."
        : `Qualified with ${c.warningCount} soft warning(s); currently at ${c.weeklyHours.toFixed(1)}h this week.`,
  }));
}
