import { Schema, model, Types, HydratedDocument } from "mongoose";
import { ShiftStatus } from "@shiftsync/shared";
import { localTimeOfDayInZone } from "../time/tz";

export interface ShiftShape {
  locationId: Types.ObjectId;
  requiredSkillId: Types.ObjectId;
  startUtc: Date;
  endUtc: Date;
  headcount: number;
  status: ShiftStatus;
  weekKey: string;
  notes: string | null;
  version: number;
  isPremium: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ShiftDocument = HydratedDocument<ShiftShape>;

const shiftSchema = new Schema<ShiftShape>(
  {
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    requiredSkillId: { type: Schema.Types.ObjectId, ref: "Skill", required: true },
    startUtc: { type: Date, required: true },
    endUtc: { type: Date, required: true },
    headcount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: Object.values(ShiftStatus),
      default: ShiftStatus.Draft,
    },
    weekKey: { type: String, required: true },
    notes: { type: String, default: null },
    version: { type: Number, default: 0 },
    isPremium: { type: Boolean, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

shiftSchema.index({ locationId: 1, weekKey: 1 });
shiftSchema.index({ locationId: 1, startUtc: 1, endUtc: 1 });
shiftSchema.index({ status: 1, weekKey: 1 });
shiftSchema.index({ startUtc: 1 });

/**
 * A shift is "premium" if its local start time falls on Friday or Saturday
 * evening (17:00 or later). Computed at write time (not a virtual) because
 * fairness analytics need it queryable via a plain index scan.
 */
export function computeIsPremium(startUtc: Date, ianaTz: string): boolean {
  const { hour, dayOfWeek } = localTimeOfDayInZone(startUtc, ianaTz);
  const isFriOrSat = dayOfWeek === 5 || dayOfWeek === 6;
  return isFriOrSat && hour >= 17;
}

export const ShiftModel = model<ShiftShape>("Shift", shiftSchema);
