import { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { AvailabilityType } from "@shiftsync/shared";
import { AvailabilityModel } from "../../models/Availability";
import { toAvailabilityDTO } from "../users/mapper";
import { notifyManagersOfAvailabilityChange } from "./service";

const recurringEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
  endLocalTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const replaceRecurringSchema = z.object({
  entries: z.array(recurringEntrySchema),
});

const exceptionSchema = z.object({
  exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isUnavailable: z.boolean(),
  exceptionStartLocalTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  exceptionEndLocalTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

export async function listAvailability(req: Request, res: Response): Promise<void> {
  const entries = await AvailabilityModel.find({ staffId: req.params.staffId }).sort({
    type: 1,
    dayOfWeek: 1,
    exceptionDate: 1,
  });
  res.json({ availability: entries.map(toAvailabilityDTO) });
}

export async function replaceRecurringAvailability(req: Request, res: Response): Promise<void> {
  const body = replaceRecurringSchema.parse(req.body);
  const staffId = new Types.ObjectId(req.params.staffId);

  await AvailabilityModel.deleteMany({ staffId, type: AvailabilityType.Recurring });
  const created = await AvailabilityModel.insertMany(
    body.entries.map((entry) => ({
      staffId,
      type: AvailabilityType.Recurring,
      dayOfWeek: entry.dayOfWeek,
      startLocalTime: entry.startLocalTime,
      endLocalTime: entry.endLocalTime,
    }))
  );

  res.json({ availability: created.map(toAvailabilityDTO) });

  await notifyManagersOfAvailabilityChange(req.params.staffId);
}

export async function addAvailabilityException(req: Request, res: Response): Promise<void> {
  const body = exceptionSchema.parse(req.body);
  const entry = await AvailabilityModel.create({
    staffId: req.params.staffId,
    type: AvailabilityType.Exception,
    exceptionDate: body.exceptionDate,
    isUnavailable: body.isUnavailable,
    exceptionStartLocalTime: body.isUnavailable ? null : body.exceptionStartLocalTime ?? null,
    exceptionEndLocalTime: body.isUnavailable ? null : body.exceptionEndLocalTime ?? null,
  });
  res.status(201).json({ availability: toAvailabilityDTO(entry) });

  await notifyManagersOfAvailabilityChange(req.params.staffId);
}
