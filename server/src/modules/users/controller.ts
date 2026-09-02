import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { FilterQuery } from "mongoose";
import { Role } from "@shiftsync/shared";
import { UserModel, UserDocument } from "../../models/User";
import { CertificationModel } from "../../models/Certification";
import { AppError } from "../../middleware/AppError";
import { toUserDTO } from "./mapper";

const SALT_ROUNDS = 10;

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  managedLocationIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  desiredWeeklyHours: z.number().nullable().optional(),
});

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  managedLocationIds: z.array(z.string()).optional(),
  skillIds: z.array(z.string()).optional(),
  desiredWeeklyHours: z.number().nullable().optional(),
});

export async function listUsers(req: Request, res: Response): Promise<void> {
  const filter: FilterQuery<UserDocument> = {};

  if (req.query.role) filter.role = req.query.role as Role;
  if (req.query.skillId) filter.skillIds = req.query.skillId as string;

  const requestedLocationId = req.query.locationId as string | undefined;

  if (req.user!.role === Role.Manager) {
    // Staff have no managedLocationIds of their own (that field only applies to
    // managers), so a manager's staff visibility is scoped via active certifications
    // at the manager's managed locations, not by filtering staff on that field.
    const scopeLocationIds = requestedLocationId
      ? req.user!.managedLocationIds.filter((id) => id === requestedLocationId)
      : req.user!.managedLocationIds;

    const certifiedStaffIds = await CertificationModel.find({
      locationId: { $in: scopeLocationIds },
      revokedAt: null,
    }).distinct("staffId");

    filter.$or = [
      { _id: { $in: certifiedStaffIds } },
      { managedLocationIds: { $in: scopeLocationIds } },
    ];
  } else if (req.user!.role === Role.Staff) {
    // Staff can see coworkers at the same locations they're certified at (needed
    // for shift rosters and picking a swap-request target), never the full org
    // directory and never anyone else's location-scoped visibility beyond that.
    const ownLocationIds = await CertificationModel.find({
      staffId: req.user!.id,
      revokedAt: null,
    }).distinct("locationId");
    const scopeLocationIds = requestedLocationId
      ? ownLocationIds.filter((id) => id.toString() === requestedLocationId)
      : ownLocationIds;

    const coworkerIds = await CertificationModel.find({
      locationId: { $in: scopeLocationIds },
      revokedAt: null,
    }).distinct("staffId");

    filter._id = { $in: coworkerIds };
  } else if (requestedLocationId) {
    const certifiedStaffIds = await CertificationModel.find({
      locationId: requestedLocationId,
      revokedAt: null,
    }).distinct("staffId");
    filter.$or = [
      { _id: { $in: certifiedStaffIds } },
      { managedLocationIds: requestedLocationId },
    ];
  }

  const users = await UserModel.find(filter).sort({ lastName: 1, firstName: 1 });
  res.json({ users: users.map(toUserDTO) });
}

export async function getUser(req: Request, res: Response): Promise<void> {
  const user = await UserModel.findById(req.params.id);
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  res.json({ user: toUserDTO(user) });
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const body = createSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
  const user = await UserModel.create({
    email: body.email,
    passwordHash,
    role: body.role,
    firstName: body.firstName,
    lastName: body.lastName,
    managedLocationIds: body.managedLocationIds ?? [],
    skillIds: body.skillIds ?? [],
    desiredWeeklyHours: body.desiredWeeklyHours ?? null,
  });
  res.status(201).json({ user: toUserDTO(user) });
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const body = updateSchema.parse(req.body);
  const user = await UserModel.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  res.json({ user: toUserDTO(user) });
}
