import { Request, Response } from "express";
import { AppError } from "../../middleware/AppError";
import * as analyticsService from "./service";

function requireWeekKey(req: Request): string {
  const weekKey = req.query.weekKey as string | undefined;
  if (!weekKey) throw new AppError(400, "MISSING_WEEK_KEY", "weekKey query parameter is required");
  return weekKey;
}

export async function hoursDistribution(req: Request, res: Response): Promise<void> {
  const entries = await analyticsService.hoursDistribution(
    req.query.locationId as string | undefined,
    requireWeekKey(req)
  );
  res.json({ entries });
}

export async function fairness(req: Request, res: Response): Promise<void> {
  const report = await analyticsService.fairnessReport(
    req.query.locationId as string | undefined,
    requireWeekKey(req)
  );
  res.json(report);
}

export async function underOverScheduled(req: Request, res: Response): Promise<void> {
  const entries = await analyticsService.underOverScheduled(
    req.query.locationId as string | undefined,
    requireWeekKey(req)
  );
  res.json({ entries });
}

export async function otDashboard(req: Request, res: Response): Promise<void> {
  const entries = await analyticsService.otDashboard(
    req.query.locationId as string | undefined,
    requireWeekKey(req)
  );
  res.json({ entries });
}

export async function onDutyNow(req: Request, res: Response): Promise<void> {
  const locationId = req.query.locationId as string | undefined;
  if (!locationId) throw new AppError(400, "MISSING_LOCATION_ID", "locationId query parameter is required");
  const entries = await analyticsService.onDutyNow(locationId);
  res.json({ entries });
}
