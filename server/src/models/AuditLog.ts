import { Schema, model, Types, HydratedDocument } from "mongoose";
import { AuditAction, AuditEntityType } from "@shiftsync/shared";

export interface AuditLogShape {
  entityType: AuditEntityType;
  entityId: Types.ObjectId;
  action: AuditAction;
  performedBy: Types.ObjectId | null;
  before: unknown;
  after: unknown;
  locationId: Types.ObjectId;
  timestamp: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLogShape>;

const auditLogSchema = new Schema<AuditLogShape>({
  entityType: { type: String, enum: Object.values(AuditEntityType), required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, enum: Object.values(AuditAction), required: true },
  performedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  before: { type: Schema.Types.Mixed, default: null },
  after: { type: Schema.Types.Mixed, default: null },
  locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
  timestamp: { type: Date, default: Date.now },
});

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1, _id: -1 });
auditLogSchema.index({ locationId: 1, timestamp: -1, _id: -1 });
auditLogSchema.index({ timestamp: -1, _id: -1 });

export const AuditLogModel = model<AuditLogShape>("AuditLog", auditLogSchema);
