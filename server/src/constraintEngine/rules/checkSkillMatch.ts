import { ConstraintRule } from "@shiftsync/shared";
import { ConstraintRuleFn, emptyResult } from "../types";

export const checkSkillMatch: ConstraintRuleFn = (ctx) => {
  const result = emptyResult();
  const hasSkill = ctx.staff.skillIds.some(
    (id) => id.toString() === ctx.shift.requiredSkillId.toString()
  );
  if (!hasSkill) {
    result.violations.push({
      rule: ConstraintRule.SkillMismatch,
      message: "Staff member does not have the skill required for this shift.",
      severity: "block",
      details: { requiredSkillId: ctx.shift.requiredSkillId.toString() },
    });
  }
  return result;
};
