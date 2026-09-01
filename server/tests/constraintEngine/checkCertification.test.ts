import { describe, expect, it } from "vitest";
import { checkCertification } from "../../src/constraintEngine/rules/checkCertification";
import { buildContext, makeCertification, makeLocation, makeShift, makeUser } from "./fixtures";

describe("checkCertification", () => {
  it("passes with an active certification at the shift's location", () => {
    const location = makeLocation();
    const staff = makeUser();
    const shift = makeShift(location);
    const cert = makeCertification(staff, location);
    const ctx = buildContext({ staff, shift, location, certifications: [cert] });

    expect(checkCertification(ctx).violations).toHaveLength(0);
  });

  it("blocks with no certification on file", () => {
    const location = makeLocation();
    const staff = makeUser();
    const shift = makeShift(location);
    const ctx = buildContext({ staff, shift, location, certifications: [] });

    const result = checkCertification(ctx);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("block");
  });

  it("blocks when the only certification for this location has been revoked", () => {
    const location = makeLocation();
    const staff = makeUser();
    const shift = makeShift(location);
    const revokedCert = makeCertification(staff, location, {
      revokedAt: new Date("2025-01-01"),
      revokedReason: "no longer qualified",
    } as never);
    const ctx = buildContext({ staff, shift, location, certifications: [revokedCert] });

    expect(checkCertification(ctx).violations).toHaveLength(1);
  });

  it("passes when a revoked cert is followed by a fresh re-cert row (history preserved)", () => {
    const location = makeLocation();
    const staff = makeUser();
    const shift = makeShift(location);
    const revokedCert = makeCertification(staff, location, {
      revokedAt: new Date("2025-01-01"),
      revokedReason: "lapsed",
    } as never);
    const recert = makeCertification(staff, location);
    const ctx = buildContext({ staff, shift, location, certifications: [revokedCert, recert] });

    expect(checkCertification(ctx).violations).toHaveLength(0);
  });

  it("blocks when the only certification is for a different location", () => {
    const location = makeLocation();
    const otherLocation = makeLocation({ name: "Other" } as never);
    const staff = makeUser();
    const shift = makeShift(location);
    const cert = makeCertification(staff, otherLocation);
    const ctx = buildContext({ staff, shift, location, certifications: [cert] });

    expect(checkCertification(ctx).violations).toHaveLength(1);
  });
});
