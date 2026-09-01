import { Schema, model, HydratedDocument } from "mongoose";

export interface LocationShape {
  name: string;
  timezone: string;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type LocationDocument = HydratedDocument<LocationShape>;

const locationSchema = new Schema<LocationShape>(
  {
    name: { type: String, required: true, trim: true },
    timezone: { type: String, required: true },
    address: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LocationModel = model<LocationShape>("Location", locationSchema);
