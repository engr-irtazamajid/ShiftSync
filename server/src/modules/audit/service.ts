import { ClientSession, Types } from "mongoose";
import { AuditAction, AuditEntityType } from "@shiftsync/shared";
import { AuditLogModel } from "../../models/AuditLog";

export interface WriteAuditInput {
  entityType: AuditEntityType;
  entityId: Types.ObjectId | string;
  action: AuditAction;
  performedBy: string | null;
  before: unknown;
  after: unknown;
  locationId: Types.ObjectId | string;
  session: ClientSession | undefined;
}

export async function writeAuditLog(input: WriteAuditInput): Promise<void> {
  await AuditLogModel.create(
    [
      {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        performedBy: input.performedBy,
        before: input.before,
        after: input.after,
        locationId: input.locationId,
        timestamp: new Date(),
      },
    ],
    { session: input.session }
  );
}
