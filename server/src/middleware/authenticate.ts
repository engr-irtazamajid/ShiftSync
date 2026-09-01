import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@shiftsync/shared";
import { env } from "../config/env";
import { AppError } from "./AppError";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  managedLocationIds: string[];
}

export interface AuthenticatedUser {
  id: string;
  role: Role;
  managedLocationIds: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.accessTokenSecret, { expiresIn: env.accessTokenTtl as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.accessTokenSecret) as AccessTokenPayload;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new AppError(401, "UNAUTHENTICATED", "Missing bearer token"));
    return;
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      managedLocationIds: payload.managedLocationIds,
    };
    next();
  } catch {
    next(new AppError(401, "INVALID_TOKEN", "Access token is invalid or expired"));
  }
}
