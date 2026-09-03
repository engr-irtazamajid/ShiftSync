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

const PAGE_SIZE = 50;

interface Cursor {
  timestamp: string;
  id: string;
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed.timestamp === "string" && typeof parsed.id === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function encodeCursor(timestamp: Date, id: string): string {
  return Buffer.from(JSON.stringify({ timestamp: timestamp.toISOString(), id }), "utf8").toString(
    "base64url"
  );
}

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const filter = buildFilter(req);
  const cursorParam = req.query.cursor as string | undefined;
  const cursor = cursorParam ? decodeCursor(cursorParam) : null;
  if (cursorParam && !cursor) {
    throw new AppError(400, "INVALID_CURSOR", "cursor is malformed");
  }

  if (cursor) {
    const cursorTimestamp = new Date(cursor.timestamp);
    filter.$or = [
      { timestamp: { $lt: cursorTimestamp } },
      { timestamp: cursorTimestamp, _id: { $lt: cursor.id } },
    ];
  }

  const logs = await AuditLogModel.find(filter)
    .sort({ timestamp: -1, _id: -1 })
    .limit(PAGE_SIZE + 1);

  const hasMore = logs.length > PAGE_SIZE;
  const page = hasMore ? logs.slice(0, PAGE_SIZE) : logs;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.timestamp, last.id.toString()) : null;

  res.json({ auditLogs: page.map(toAuditLogDTO), nextCursor });
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
