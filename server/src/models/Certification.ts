import { Schema, model, Types, HydratedDocument } from "mongoose";

export interface CertificationShape {
  staffId: Types.ObjectId;
  locationId: Types.ObjectId;
  certifiedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CertificationDocument = HydratedDocument<CertificationShape>;

const certificationSchema = new Schema<CertificationShape>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    certifiedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { timestamps: true }
);

certificationSchema.index({ staffId: 1, locationId: 1, revokedAt: 1 });

export const CertificationModel = model<CertificationShape>("Certification", certificationSchema);
