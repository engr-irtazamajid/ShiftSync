import { AuditAction, AuditEntityType } from "../enums";

export interface AuditLogDTO {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  performedBy: string | null;
  before: unknown;
  after: unknown;
  locationId: string;
  timestamp: string;
}

export interface AuditLogPageDTO {
  auditLogs: AuditLogDTO[];
  nextCursor: string | null;
}
