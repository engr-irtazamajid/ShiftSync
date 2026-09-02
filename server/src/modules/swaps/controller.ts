import { Request, Response } from "express";
import { z } from "zod";
import { Role, SwapStatus, SwapType } from "@shiftsync/shared";
import { toSwapRequestDTO } from "./mapper";
import * as swapsService from "./service";

const createSchema = z.object({
  assignmentId: z.string().min(1),
  type: z.nativeEnum(SwapType),
  targetStaffId: z.string().optional(),
});

const denySchema = z.object({
  reason: z.string().min(1),
});

export async function listSwaps(req: Request, res: Response): Promise<void> {
  const swaps = await swapsService.listSwaps({
    status: req.query.status as SwapStatus | undefined,
    type: req.query.type as SwapType | undefined,
    requestedBy: req.query.requestedBy as string | undefined,
    targetStaffId: req.query.targetStaffId as string | undefined,
  });
  res.json({ swapRequests: swaps.map(toSwapRequestDTO) });
}

export async function createSwap(req: Request, res: Response): Promise<void> {
  const body = createSchema.parse(req.body);
  const swap = await swapsService.createSwapRequest({ ...body, requestedBy: req.user!.id });
  res.status(201).json({ swapRequest: toSwapRequestDTO(swap) });
}

export async function acceptSwap(req: Request, res: Response): Promise<void> {
  const swap = await swapsService.acceptSwap(req.params.id, req.user!.id);
  res.json({ swapRequest: toSwapRequestDTO(swap) });
}

export async function rejectSwap(req: Request, res: Response): Promise<void> {
  const swap = await swapsService.rejectSwap(req.params.id, req.user!.id);
  res.json({ swapRequest: toSwapRequestDTO(swap) });
}

export async function claimSwap(req: Request, res: Response): Promise<void> {
  const swap = await swapsService.claimDrop(req.params.id, req.user!.id);
  res.json({ swapRequest: toSwapRequestDTO(swap) });
}

export async function withdrawSwap(req: Request, res: Response): Promise<void> {
  const swap = await swapsService.withdrawSwap(req.params.id, req.user!.id);
  res.json({ swapRequest: toSwapRequestDTO(swap) });
}

export async function approveSwap(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user!.role === Role.Admin;
  const { swap } = await swapsService.approveSwap(
    req.params.id,
    req.user!.id,
    req.user!.managedLocationIds,
    isAdmin
  );
  res.json({ swapRequest: toSwapRequestDTO(swap) });
}

export async function denySwap(req: Request, res: Response): Promise<void> {
  const body = denySchema.parse(req.body);
  const isAdmin = req.user!.role === Role.Admin;
  const swap = await swapsService.denySwap(
    req.params.id,
    req.user!.id,
    req.user!.managedLocationIds,
    isAdmin,
    body.reason
  );
  res.json({ swapRequest: toSwapRequestDTO(swap) });
}
