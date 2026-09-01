import { Schema, model, Types, HydratedDocument } from "mongoose";
import { AssignmentStatus } from "@shiftsync/shared";

export interface AssignmentShape {
  shiftId: Types.ObjectId;
  staffId: Types.ObjectId;
  status: AssignmentStatus;
  version: number;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  releasedAt: Date | null;
  releasedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AssignmentDocument = HydratedDocument<AssignmentShape>;

const assignmentSchema = new Schema<AssignmentShape>(
  {
    shiftId: { type: Schema.Types.ObjectId, ref: "Shift", required: true },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: Object.values(AssignmentStatus),
      default: AssignmentStatus.Active,
    },
    version: { type: Number, default: 0 },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedAt: { type: Date, required: true },
    releasedAt: { type: Date, default: null },
    releasedReason: { type: String, default: null },
  },
  { timestamps: true }
);

assignmentSchema.index({ staffId: 1, status: 1 });
assignmentSchema.index({ shiftId: 1, status: 1 });

export const AssignmentModel = model<AssignmentShape>("Assignment", assignmentSchema);
