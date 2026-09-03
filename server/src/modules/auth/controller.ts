import { CookieOptions, Request, Response } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { toUserDTO } from "../users/mapper";
import * as authService from "./service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const REFRESH_COOKIE_NAME = "refreshToken";

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict",
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  };
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);
  const { tokens, user } = await authService.login(email, password);

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions());
  res.json({ accessToken: tokens.accessToken, user: toUserDTO(user) });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    res.status(401).json({
      error: { code: "MISSING_REFRESH_TOKEN", message: "No refresh token cookie present" },
    });
    return;
  }

  const { tokens, user } = await authService.refresh(token);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions());
  res.json({ accessToken: tokens.accessToken, user: toUserDTO(user) });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    await authService.logoutByRefreshToken(token);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
  res.status(204).send();
}
