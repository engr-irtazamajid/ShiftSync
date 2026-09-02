import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import authRoutes from "./modules/auth/routes";
import usersRoutes from "./modules/users/routes";
import locationsRoutes from "./modules/locations/routes";
import skillsRoutes from "./modules/skills/routes";
import shiftsRoutes from "./modules/shifts/routes";
import assignmentsRoutes from "./modules/assignments/routes";
import swapsRoutes from "./modules/swaps/routes";
import notificationsRoutes from "./modules/notifications/routes";
import auditRoutes from "./modules/audit/routes";
import analyticsRoutes from "./modules/analytics/routes";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/locations", locationsRoutes);
  app.use("/api/skills", skillsRoutes);
  app.use("/api/shifts", shiftsRoutes);
  app.use("/api/assignments", assignmentsRoutes);
  app.use("/api/swaps", swapsRoutes);
  app.use("/api", notificationsRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/analytics", analyticsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
