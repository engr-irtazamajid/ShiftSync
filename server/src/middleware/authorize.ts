import { NextFunction, Request, Response } from "express";
import { Role } from "@shiftsync/shared";
import { AppError } from "./AppError";
import { CertificationModel } from "../models/Certification";

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, "UNAUTHENTICATED", "Missing authenticated user"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
      return;
    }
    next();
  };
}

/**
 * For role=manager, restricts access to locations in managedLocationIds.
 * Reads the target location id from req.params.locationId, req.query.locationId,
 * or req.body.locationId (checked in that order). Admin is unrestricted; staff
 * never reaches routes gated by this middleware.
 */
export function scopeToManagedLocation(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError(401, "UNAUTHENTICATED", "Missing authenticated user"));
    return;
  }
  if (req.user.role === Role.Admin) {
    next();
    return;
  }
  if (req.user.role !== Role.Manager) {
    next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
    return;
  }

  const locationId =
    (req.params.locationId as string | undefined) ??
    (req.query.locationId as string | undefined) ??
    (req.body?.locationId as string | undefined);

  if (!locationId) {
    next(new AppError(400, "MISSING_LOCATION", "locationId is required"));
    return;
  }

  if (!req.user.managedLocationIds.includes(locationId)) {
    next(new AppError(403, "OUT_OF_SCOPE", "This location is outside your managed scope"));
    return;
  }

  next();
}

/**
 * Restricts access to a specific staff member's data to: that staff member
 * themself, admins, or managers whose managedLocationIds overlap that staff
 * member's active certifications. Staff attempting to view/edit anyone else's
 * data are rejected. Reads the target staff id from req.params.staffId (nested
 * /users/:staffId/... routes) or req.params.id (direct /users/:id routes).
 */
export async function scopeToOwnStaffOrManager(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    next(new AppError(401, "UNAUTHENTICATED", "Missing authenticated user"));
    return;
  }

  const targetStaffId = req.params.staffId ?? req.params.id;
  if (req.user.role === Role.Admin || req.user.id === targetStaffId) {
    next();
    return;
  }

  if (req.user.role !== Role.Manager) {
    next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
    return;
  }

  const certifiedLocationIds = await CertificationModel.find({
    staffId: targetStaffId,
    revokedAt: null,
  }).distinct("locationId");

  const inScope = certifiedLocationIds.some((locationId) =>
    req.user!.managedLocationIds.includes(locationId.toString())
  );

  if (!inScope) {
    next(new AppError(403, "OUT_OF_SCOPE", "This staff member is outside your managed scope"));
    return;
  }

  next();
}
