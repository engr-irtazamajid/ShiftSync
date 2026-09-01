import { ConstraintRule } from "@shiftsync/shared";
import { ConstraintRuleFn, emptyResult } from "../types";

export const checkCertification: ConstraintRuleFn = (ctx) => {
  const result = emptyResult();
  const hasActiveCert = ctx.certifications.some(
    (cert) =>
      cert.locationId.toString() === ctx.shift.locationId.toString() &&
      cert.revokedAt === null
  );
  if (!hasActiveCert) {
    result.violations.push({
      rule: ConstraintRule.NotCertified,
      message: "Staff member does not hold an active certification for this location.",
      severity: "block",
      details: { locationId: ctx.shift.locationId.toString() },
    });
  }
  return result;
};
