import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { Role } from "@shiftsync/shared";
import { env } from "../config/env";
import { verifyAccessToken, AccessTokenPayload } from "../middleware/authenticate";
import { LocationModel } from "../models/Location";
import { CertificationModel } from "../models/Certification";
import { setIo } from "./emitters";

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function locationRoom(locationId: string): string {
  return `location:${locationId}`;
}

function getAuthUser(socket: Socket): AccessTokenPayload {
  return socket.data.authUser as AccessTokenPayload;
}

async function joinScopedRooms(socket: Socket): Promise<void> {
  const { sub, role, managedLocationIds } = getAuthUser(socket);
  await socket.join(userRoom(sub));

  if (role === Role.Admin) {
    const locations = await LocationModel.find({ isActive: true }).select("_id");
    for (const location of locations) {
      await socket.join(locationRoom(location._id.toString()));
    }
    return;
  }

  if (role === Role.Manager) {
    for (const locationId of managedLocationIds) {
      await socket.join(locationRoom(locationId));
    }
    return;
  }

  const certifications = await CertificationModel.find({
    staffId: sub,
    revokedAt: null,
  }).select("locationId");
  for (const certification of certifications) {
    await socket.join(locationRoom(certification.locationId.toString()));
  }
}

export function initSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("unauthorized"));
      return;
    }
    try {
      socket.data.authUser = verifyAccessToken(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    joinScopedRooms(socket).catch(() => {
      socket.disconnect(true);
    });
  });

  setIo(io);
  return io;
}
