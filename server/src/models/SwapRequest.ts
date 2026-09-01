import { Schema, model, Types, HydratedDocument } from "mongoose";
import { SwapStatus, SwapType } from "@shiftsync/shared";

export interface SwapRequestShape {
  type: SwapType;
  assignmentId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  targetStaffId: Types.ObjectId | null;
  claimedBy: Types.ObjectId | null;
  status: SwapStatus;
  managerDecisionBy: Types.ObjectId | null;
  managerDecisionAt: Date | null;
  managerDecisionReason: string | null;
  expiresAt: Date | null;
  autoCancelledReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SwapRequestDocument = HydratedDocument<SwapRequestShape>;

const swapRequestSchema = new Schema<SwapRequestShape>(
  {
    type: { type: String, enum: Object.values(SwapType), required: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetStaffId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    claimedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: Object.values(SwapStatus), required: true },
    managerDecisionBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    managerDecisionAt: { type: Date, default: null },
    managerDecisionReason: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    autoCancelledReason: { type: String, default: null },
  },
  { timestamps: true }
);

swapRequestSchema.index({ requestedBy: 1, status: 1 });
swapRequestSchema.index({ assignmentId: 1, status: 1 });
swapRequestSchema.index({ type: 1, status: 1, expiresAt: 1 });

export const SwapRequestModel = model<SwapRequestShape>(
  "SwapRequest",
  swapRequestSchema
);
