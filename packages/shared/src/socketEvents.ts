export const SocketEvent = {
  SchedulePublished: "schedule:published",
  ScheduleUnpublished: "schedule:unpublished",
  ShiftUpdated: "shift:updated",
  AssignmentCreated: "assignment:created",
  AssignmentRemoved: "assignment:removed",
  AssignmentConflict: "assignment:conflict",
  SwapCreated: "swap:created",
  SwapResolved: "swap:resolved",
  OnDutyUpdated: "on-duty:updated",
  NotificationNew: "notification:new",
} as const;

export type SocketEventName = (typeof SocketEvent)[keyof typeof SocketEvent];

export interface SchedulePublishedPayload {
  locationId: string;
  weekKey: string;
  shiftIds: string[];
}

export interface ScheduleUnpublishedPayload {
  locationId: string;
  weekKey: string;
}

export interface ShiftUpdatedPayload {
  shift: unknown;
}

export interface AssignmentConflictPayload {
  code: "SHIFT_VERSION_CONFLICT" | "SHIFT_FULL";
  shiftId: string;
  currentShift: unknown;
}

export interface SwapResolvedPayload {
  swapRequest: unknown;
  resolution: "approved" | "denied" | "auto_cancelled" | "expired" | "withdrawn";
}

export interface OnDutyUpdatedPayload {
  locationId: string;
  onDuty: Array<{
    staffId: string;
    name: string;
    shiftId: string;
    clockedInAt: string;
  }>;
}
