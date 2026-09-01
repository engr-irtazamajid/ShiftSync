import { ClientSession } from "mongoose";
import { ConstraintCheckResult } from "@shiftsync/shared";
import { loadEvaluationContext } from "./loadContext";
import { runAllRules } from "./runRules";
import { suggestAlternatives } from "./suggestAlternatives";

export interface EvaluateAssignmentInput {
  staffId: string;
  shiftId: string;
  excludeAssignmentId?: string;
  session?: ClientSession;
  allowManagerOverride?: boolean;
  overrideReason?: string;
}

/**
 * The single entry point for constraint logic. Both POST /shifts/:id/assign
 * and POST /swaps/:id/approve call this identically (by IDs, optionally
 * inside a shared transaction session) so neither path can bypass a rule the
 * other enforces.
 */
export async function evaluateAssignment(
  input: EvaluateAssignmentInput
): Promise<ConstraintCheckResult> {
  const ctx = await loadEvaluationContext(input);
  const { violations, warnings } = runAllRules(ctx);

  const hasBlock = violations.some((v) => v.severity === "block");

  const suggestedAlternatives = hasBlock
    ? await suggestAlternatives(input.shiftId, input.staffId, input.session)
    : [];

  return {
    passed: !hasBlock,
    violations,
    warnings,
    suggestedAlternatives,
  };
}

export { loadEvaluationContext } from "./loadContext";
export { runAllRules } from "./runRules";
export * from "./types";
