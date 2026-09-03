import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { AppError } from "./AppError";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.originalUrl}` },
  } satisfies ErrorBody);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    } satisfies ErrorBody);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten(),
      },
    } satisfies ErrorBody);
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
        details: Object.fromEntries(
          Object.entries(err.errors).map(([key, value]) => [key, value.message])
        ),
      },
    } satisfies ErrorBody);
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      error: { code: "INVALID_ID", message: `Invalid value for ${err.path}: ${err.value}` },
    } satisfies ErrorBody);
    return;
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  ) {
    res.status(409).json({
      error: { code: "DUPLICATE_KEY", message: "A record with this value already exists" },
    } satisfies ErrorBody);
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  } satisfies ErrorBody);
}
