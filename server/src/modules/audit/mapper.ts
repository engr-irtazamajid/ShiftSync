import { AuditLogDTO } from "@shiftsync/shared";
import { AuditLogDocument } from "../../models/AuditLog";

export function toAuditLogDTO(log: AuditLogDocument): AuditLogDTO {
  return {
    id: log.id.toString(),
    entityType: log.entityType,
    entityId: log.entityId.toString(),
    action: log.action,
    performedBy: log.performedBy ? log.performedBy.toString() : null,
    before: log.before,
    after: log.after,
    locationId: log.locationId.toString(),
    timestamp: log.timestamp.toISOString(),
  };
}
