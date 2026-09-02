import { Request, Response } from "express";
import { z } from "zod";
import { Role } from "@shiftsync/shared";
import { toAssignmentDTO } from "./mapper";
import { toShiftDTO } from "../shifts/mapper";
import * as assignmentsService from "./service";

const assignSchema = z.object({
  staffId: z.string().min(1),
  expectedShiftVersion: z.number().int().min(0),
  allowManagerOverride: z.boolean().optional(),
  overrideReason: z.string().optional(),
});

const previewSchema = z.object({
  staffId: z.string().min(1),
});

const unassignSchema = z.object({
  reason: z.string().min(1).optional(),
});

const listSchema = z.object({
  shiftId: z.string().min(1).optional(),
  shiftIds: z.string().optional(),
  staffId: z.string().min(1).optional(),
  ids: z.string().optional(),
});

export async function assignStaff(req: Request, res: Response): Promise<void> {
  const body = assignSchema.parse(req.body);
  const isAdmin = req.user!.role === Role.Admin;

  const { assignment, shift } = await assignmentsService.assignStaff({
    shiftId: req.params.shiftId,
    staffId: body.staffId,
    expectedShiftVersion: body.expectedShiftVersion,
    requestedBy: req.user!.id,
    isAdmin,
    managerLocationIds: req.user!.managedLocationIds,
    allowManagerOverride: isAdmin ? body.allowManagerOverride : false,
    overrideReason: isAdmin ? body.overrideReason : undefined,
  });

  res.status(201).json({ assignment: toAssignmentDTO(assignment), shift: toShiftDTO(shift) });
}

export async function previewAssignment(req: Request, res: Response): Promise<void> {
  const body = previewSchema.parse(req.body);
  const result = await assignmentsService.previewAssignment(body.staffId, req.params.shiftId);
  res.json(result);
}

export async function unassignStaff(req: Request, res: Response): Promise<void> {
  const body = unassignSchema.parse(req.body);
  const isAdmin = req.user!.role === Role.Admin;
  await assignmentsService.unassignStaff(
    req.params.id,
    req.user!.id,
    body.reason ?? "Removed by manager",
    isAdmin,
    req.user!.managedLocationIds
  );
  res.status(204).send();
}

export async function listAssignments(req: Request, res: Response): Promise<void> {
  const query = listSchema.parse(req.query);

  if (query.ids !== undefined) {
    const ids = query.ids.split(",").filter(Boolean);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    const assignments = await assignmentsService.listAssignments({ ids });
    res.json(assignments.map(toAssignmentDTO));
    return;
  }

  if (query.shiftIds !== undefined) {
    const shiftIds = query.shiftIds.split(",").filter(Boolean);
    if (shiftIds.length === 0) {
      res.json([]);
      return;
    }
    const assignments = await assignmentsService.listAssignments({
      shiftId: query.shiftId,
      shiftIds,
      staffId: query.staffId,
    });
    res.json(assignments.map(toAssignmentDTO));
    return;
  }

  const assignments = await assignmentsService.listAssignments({
    shiftId: query.shiftId,
    staffId: query.staffId,
  });
  res.json(assignments.map(toAssignmentDTO));
}
