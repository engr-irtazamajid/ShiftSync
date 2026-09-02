import type { Server } from "socket.io";
import {
  AssignmentConflictPayload,
  OnDutyUpdatedPayload,
  SchedulePublishedPayload,
  ScheduleUnpublishedPayload,
  ShiftUpdatedPayload,
  SocketEvent,
  SwapResolvedPayload,
} from "@shiftsync/shared";

let ioRef: Server | null = null;

export function setIo(io: Server): void {
  ioRef = io;
}

function locationRoom(locationId: string): string {
  return `location:${locationId}`;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function emitSchedulePublished(payload: SchedulePublishedPayload): void {
  ioRef?.to(locationRoom(payload.locationId)).emit(SocketEvent.SchedulePublished, payload);
}

export function emitScheduleUnpublished(payload: ScheduleUnpublishedPayload): void {
  ioRef?.to(locationRoom(payload.locationId)).emit(SocketEvent.ScheduleUnpublished, payload);
}

export function emitShiftUpdated(locationId: string, payload: ShiftUpdatedPayload): void {
  ioRef?.to(locationRoom(locationId)).emit(SocketEvent.ShiftUpdated, payload);
}

export function emitAssignmentCreated(staffId: string, assignment: unknown): void {
  ioRef?.to(userRoom(staffId)).emit(SocketEvent.AssignmentCreated, assignment);
}

export function emitAssignmentRemoved(staffId: string, assignment: unknown): void {
  ioRef?.to(userRoom(staffId)).emit(SocketEvent.AssignmentRemoved, assignment);
}

export function emitAssignmentConflict(managerId: string, payload: AssignmentConflictPayload): void {
  ioRef?.to(userRoom(managerId)).emit(SocketEvent.AssignmentConflict, payload);
}

export function emitSwapCreated(locationId: string, swapRequest: unknown): void {
  ioRef?.to(locationRoom(locationId)).emit(SocketEvent.SwapCreated, swapRequest);
}

export function emitSwapResolved(userIds: string[], payload: SwapResolvedPayload): void {
  for (const userId of userIds) {
    ioRef?.to(userRoom(userId)).emit(SocketEvent.SwapResolved, payload);
  }
}

export function emitOnDutyUpdated(payload: OnDutyUpdatedPayload): void {
  ioRef?.to(locationRoom(payload.locationId)).emit(SocketEvent.OnDutyUpdated, payload);
}

export function emitNotificationNew(userId: string, notification: unknown): void {
  ioRef?.to(userRoom(userId)).emit(SocketEvent.NotificationNew, notification);
}
