import { Request, Response } from "express";
import { z } from "zod";
import { Role } from "@shiftsync/shared";
import { CertificationModel } from "../../models/Certification";
import { AppError } from "../../middleware/AppError";
import { toCertificationDTO } from "../users/mapper";

function assertLocationInManagerScope(req: Request, locationId: string): void {
  if (req.user!.role === Role.Admin) return;
  if (!req.user!.managedLocationIds.includes(locationId)) {
    throw new AppError(403, "OUT_OF_SCOPE", "This location is outside your managed scope");
  }
}

const createSchema = z.object({
  locationId: z.string().min(1),
  certifiedAt: z.string().datetime().optional(),
});

const revokeSchema = z.object({
  reason: z.string().min(1),
});

export async function listCertifications(req: Request, res: Response): Promise<void> {
  const certs = await CertificationModel.find({ staffId: req.params.staffId }).sort({
    certifiedAt: -1,
  });
  res.json({ certifications: certs.map(toCertificationDTO) });
}

export async function createCertification(req: Request, res: Response): Promise<void> {
  const body = createSchema.parse(req.body);
  assertLocationInManagerScope(req, body.locationId);

  const cert = await CertificationModel.create({
    staffId: req.params.staffId,
    locationId: body.locationId,
    certifiedAt: body.certifiedAt ? new Date(body.certifiedAt) : new Date(),
  });
  res.status(201).json({ certification: toCertificationDTO(cert) });
}

export async function revokeCertification(req: Request, res: Response): Promise<void> {
  const body = revokeSchema.parse(req.body);
  const cert = await CertificationModel.findOne({
    _id: req.params.certId,
    staffId: req.params.staffId,
  });
  if (!cert) throw new AppError(404, "CERTIFICATION_NOT_FOUND", "Certification not found");
  if (cert.revokedAt)
    throw new AppError(409, "ALREADY_REVOKED", "Certification is already revoked");

  assertLocationInManagerScope(req, cert.locationId.toString());

  cert.revokedAt = new Date();
  cert.revokedReason = body.reason;
  await cert.save();

  res.json({ certification: toCertificationDTO(cert) });
}
