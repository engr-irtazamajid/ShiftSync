import { Request, Response } from "express";
import { z } from "zod";
import { LocationModel } from "../../models/Location";
import { AppError } from "../../middleware/AppError";
import { toLocationDTO } from "./mapper";

const createSchema = z.object({
  name: z.string().min(1),
  timezone: z.string().min(1),
  address: z.string().nullable().optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export async function listLocations(_req: Request, res: Response): Promise<void> {
  const locations = await LocationModel.find().sort({ name: 1 });
  res.json({ locations: locations.map(toLocationDTO) });
}

export async function createLocation(req: Request, res: Response): Promise<void> {
  const body = createSchema.parse(req.body);
  const location = await LocationModel.create({ ...body, address: body.address ?? null });
  res.status(201).json({ location: toLocationDTO(location) });
}

export async function updateLocation(req: Request, res: Response): Promise<void> {
  const body = updateSchema.parse(req.body);
  const location = await LocationModel.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!location) throw new AppError(404, "LOCATION_NOT_FOUND", "Location not found");
  res.json({ location: toLocationDTO(location) });
}
