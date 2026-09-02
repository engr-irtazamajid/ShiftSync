import { Request, Response } from "express";
import { z } from "zod";
import { Role, ShiftStatus } from "@shiftsync/shared";
import { toShiftDTO } from "./mapper";
import { toAuditLogDTO } from "../audit/mapper";
import * as shiftsService from "./service";

const createSchema = z.object({
  locationId: z.string().min(1),
  requiredSkillId: z.string().min(1),
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
  headcount: z.number().int().min(1),
  notes: z.string().nullable().optional(),
});

const updateSchema = z.object({
  startUtc: z.string().datetime().optional(),
  endUtc: z.string().datetime().optional(),
  headcount: z.number().int().min(1).optional(),
  notes: z.string().nullable().optional(),
  requiredSkillId: z.string().optional(),
});

const publishSchema = z.object({
  locationId: z.string().min(1),
  weekKey: z.string().min(1),
});

export async function createShift(req: Request, res: Response): Promise<void> {
  const body = createSchema.parse(req.body);
  const shift = await shiftsService.createShift({ ...body, createdBy: req.user!.id });
  res.status(201).json({ shift: toShiftDTO(shift) });
}

export async function listShifts(req: Request, res: Response): Promise<void> {
  const idsParam = req.query.ids as string | undefined;
  const shifts = await shiftsService.listShifts({
    locationId: req.query.locationId as string | undefined,
    weekKey: req.query.weekKey as string | undefined,
    status: req.query.status as ShiftStatus | undefined,
    ids: idsParam ? idsParam.split(",").filter(Boolean) : undefined,
  });
  res.json({ shifts: shifts.map(toShiftDTO) });
}

export async function getShift(req: Request, res: Response): Promise<void> {
  const shift = await shiftsService.getShift(req.params.id);
  res.json({ shift: toShiftDTO(shift) });
}

export async function updateShift(req: Request, res: Response): Promise<void> {
  const body = updateSchema.parse(req.body);
  const isAdmin = req.user!.role === Role.Admin;
  const shift = await shiftsService.updateShift(
    req.params.id,
    body,
    req.user!.id,
    isAdmin,
    req.user!.managedLocationIds
  );
  res.json({ shift: toShiftDTO(shift) });
}

export async function cancelShift(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user!.role === Role.Admin;
  const shift = await shiftsService.cancelShift(
    req.params.id,
    req.user!.id,
    isAdmin,
    req.user!.managedLocationIds
  );
  res.json({ shift: toShiftDTO(shift) });
}

export async function publishShifts(req: Request, res: Response): Promise<void> {
  const body = publishSchema.parse(req.body);
  const shiftIds = await shiftsService.publishShifts(body.locationId, body.weekKey, req.user!.id);
  res.json({ shiftIds });
}

export async function unpublishShifts(req: Request, res: Response): Promise<void> {
  const body = publishSchema.parse(req.body);
  const shiftIds = await shiftsService.unpublishShifts(body.locationId, body.weekKey, req.user!.id);
  res.json({ shiftIds });
}

export async function getShiftHistory(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user!.role === Role.Admin;
  const history = await shiftsService.getShiftHistory(
    req.params.id,
    isAdmin,
    req.user!.managedLocationIds
  );
  res.json({ auditLogs: history.map(toAuditLogDTO) });
}
