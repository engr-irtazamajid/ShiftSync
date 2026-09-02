import { Request, Response } from "express";
import { FilterQuery } from "mongoose";
import { AuditAction, AuditEntityType } from "@shiftsync/shared";
import { AuditLogModel, AuditLogDocument } from "../../models/AuditLog";
import { AppError } from "../../middleware/AppError";
import { toAuditLogDTO } from "./mapper";

function buildFilter(req: Request): FilterQuery<AuditLogDocument> {
  const filter: FilterQuery<AuditLogDocument> = {};
  if (req.query.entityType) filter.entityType = req.query.entityType as AuditEntityType;
  if (req.query.entityId) filter.entityId = req.query.entityId as string;
  if (req.query.action) filter.action = req.query.action as AuditAction;
  if (req.query.locationId) filter.locationId = req.query.locationId as string;
  if (req.query.performedBy) filter.performedBy = req.query.performedBy as string;

  if (req.query.from || req.query.to) {
    filter.timestamp = {};
    if (req.query.from) filter.timestamp.$gte = new Date(req.query.from as string);
    if (req.query.to) filter.timestamp.$lte = new Date(req.query.to as string);
  }

  return filter;
}

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const filter = buildFilter(req);
  const logs = await AuditLogModel.find(filter).sort({ timestamp: -1 }).limit(500);
  res.json({ auditLogs: logs.map(toAuditLogDTO) });
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(logs: AuditLogDocument[]): string {
  const headers = [
    "id",
    "entityType",
    "entityId",
    "action",
    "performedBy",
    "locationId",
    "timestamp",
    "before",
    "after",
  ];
  const rows = logs.map((log) =>
    [
      log.id.toString(),
      log.entityType,
      log.entityId.toString(),
      log.action,
      log.performedBy ? log.performedBy.toString() : "",
      log.locationId.toString(),
      log.timestamp.toISOString(),
      JSON.stringify(log.before ?? null),
      JSON.stringify(log.after ?? null),
    ]
      .map(csvEscape)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\r\n");
}

export async function exportAuditLogs(req: Request, res: Response): Promise<void> {
  const format = (req.query.format as string) ?? "json";
  if (format !== "csv" && format !== "json") {
    throw new AppError(400, "INVALID_FORMAT", "format must be csv or json");
  }

  const filter = buildFilter(req);
  const logs = await AuditLogModel.find(filter).sort({ timestamp: -1 });

  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit-export.csv");
    res.send(toCsv(logs));
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=audit-export.json");
  res.json({ auditLogs: logs.map(toAuditLogDTO) });
}
