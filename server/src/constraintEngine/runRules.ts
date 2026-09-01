import { ConstraintViolation, ConstraintWarningEntry } from "@shiftsync/shared";
import {
  checkAvailability,
  checkCertification,
  checkConsecutiveDays,
  checkDailyHours,
  checkDoubleBooking,
  checkMinRest,
  checkSkillMatch,
  checkWeeklyHours,
} from "./rules";
import { ConstraintRuleFn, EvaluationContext } from "./types";

const RULES: ConstraintRuleFn[] = [
  checkSkillMatch,
  checkCertification,
  checkAvailability,
  checkDoubleBooking,
  checkMinRest,
  checkDailyHours,
  checkWeeklyHours,
  checkConsecutiveDays,
];

export function runAllRules(ctx: EvaluationContext): {
  violations: ConstraintViolation[];
  warnings: ConstraintWarningEntry[];
} {
  const results = RULES.map((rule) => rule(ctx));
  return {
    violations: results.flatMap((r) => r.violations),
    warnings: results.flatMap((r) => r.warnings),
  };
}
