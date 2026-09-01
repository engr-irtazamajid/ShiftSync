import { ConstraintRule, ConstraintWarning } from "./enums";

export type ConstraintSeverity = "block" | "warn";

export interface ConstraintViolation {
  rule: ConstraintRule;
  message: string;
  severity: ConstraintSeverity;
  details?: Record<string, unknown>;
}

export interface ConstraintWarningEntry {
  rule: ConstraintWarning;
  message: string;
  details?: Record<string, unknown>;
}

export interface SuggestedAlternative {
  staffId: string;
  name: string;
  reason: string;
}

export interface ConstraintCheckResult {
  passed: boolean;
  violations: ConstraintViolation[];
  warnings: ConstraintWarningEntry[];
  suggestedAlternatives: SuggestedAlternative[];
}

export interface AssignmentPreviewResult extends ConstraintCheckResult {
  projectedWeeklyHours: number;
  projectedWeeklyOvertimeHours: number;
  projectedWeeklyOvertimeCost: number;
  pushesIntoOvertime: boolean;
}
