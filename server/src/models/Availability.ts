import { Schema, model, Types, HydratedDocument } from "mongoose";
import { AvailabilityType } from "@shiftsync/shared";

export interface AvailabilityShape {
  staffId: Types.ObjectId;
  type: AvailabilityType;
  dayOfWeek: number | null;
  startLocalTime: string | null;
  endLocalTime: string | null;
  exceptionDate: string | null;
  exceptionStartLocalTime: string | null;
  exceptionEndLocalTime: string | null;
  isUnavailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AvailabilityDocument = HydratedDocument<AvailabilityShape>;

const availabilitySchema = new Schema<AvailabilityShape>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: Object.values(AvailabilityType), required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, default: null },
    startLocalTime: { type: String, default: null },
    endLocalTime: { type: String, default: null },
    exceptionDate: { type: String, default: null },
    exceptionStartLocalTime: { type: String, default: null },
    exceptionEndLocalTime: { type: String, default: null },
    isUnavailable: { type: Boolean, default: false },
  },
  { timestamps: true }
);

availabilitySchema.index({ staffId: 1, type: 1 });
availabilitySchema.index({ staffId: 1, exceptionDate: 1 });

export const AvailabilityModel = model<AvailabilityShape>(
  "Availability",
  availabilitySchema
);
