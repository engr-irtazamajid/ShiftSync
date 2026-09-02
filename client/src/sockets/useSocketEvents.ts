import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationType, SocketEvent } from "@shiftsync/shared";
import type {
  AssignmentConflictPayload,
  NotificationDTO,
  SchedulePublishedPayload,
  ScheduleUnpublishedPayload,
  SwapResolvedPayload,
} from "@shiftsync/shared";
import { getSocket } from "./socketClient";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { ToastVariant } from "@/components/ui/toast";

function variantForNotification(notification: NotificationDTO): ToastVariant {
  switch (notification.type) {
    case NotificationType.OvertimeWarning:
      return "warning";
    case NotificationType.SwapResolved: {
      const body = notification.body.toLowerCase();
      if (body.includes("denied")) return "warning";
      if (body.includes("auto") || body.includes("expired")) return "warning";
      // approved, withdrawn: the request resolved the way the actor intended
      return "success";
    }
    case NotificationType.ShiftAssigned:
    case NotificationType.SchedulePublished:
      return "success";
    case NotificationType.ShiftChanged:
    case NotificationType.ShiftUnassigned:
    case NotificationType.AvailabilityChanged:
      return "warning";
    case NotificationType.SwapRequested:
    case NotificationType.DropAvailable:
    case NotificationType.ApprovalNeeded:
      return "default";
    default:
      return "default";
  }
}

export function useSocketEvents() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket();
    if (!socket) return;

    const invalidateShifts = (payload: { locationId: string; weekKey: string }) => {
      queryClient.invalidateQueries({ queryKey: ["shifts", payload.locationId, payload.weekKey] });
    };

    const onShiftUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    };

    const onNotificationNew = (notification: NotificationDTO) => {
      queryClient.setQueryData<NotificationDTO[]>(["notifications"], (existing) =>
        existing ? [notification, ...existing] : [notification]
      );
      toast({
        variant: variantForNotification(notification),
        title: notification.title,
        description: notification.body,
      });
    };

    const onSwapResolved = (_payload: SwapResolvedPayload) => {
      queryClient.invalidateQueries({ queryKey: ["swaps"] });
    };

    const onAssignmentConflict = (payload: AssignmentConflictPayload) => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.setQueryData(["assignment-conflict"], payload);
      toast({
        variant: "destructive",
        title: "Assignment conflict",
        description:
          payload.code === "SHIFT_FULL"
            ? "This shift just reached its required headcount."
            : "This shift was just changed by another manager. The schedule has been refreshed.",
      });
    };

    const onOnDutyUpdated = (payload: { locationId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["on-duty-now", payload.locationId] });
    };

    socket.on(SocketEvent.SchedulePublished, (p: SchedulePublishedPayload) => invalidateShifts(p));
    socket.on(SocketEvent.ScheduleUnpublished, (p: ScheduleUnpublishedPayload) => invalidateShifts(p));
    socket.on(SocketEvent.ShiftUpdated, onShiftUpdated);
    socket.on(SocketEvent.AssignmentCreated, onShiftUpdated);
    socket.on(SocketEvent.AssignmentRemoved, onShiftUpdated);
    socket.on(SocketEvent.AssignmentConflict, onAssignmentConflict);
    socket.on(SocketEvent.SwapCreated, onSwapResolved);
    socket.on(SocketEvent.SwapResolved, onSwapResolved);
    socket.on(SocketEvent.OnDutyUpdated, onOnDutyUpdated);
    socket.on(SocketEvent.NotificationNew, onNotificationNew);

    return () => {
      socket.off(SocketEvent.SchedulePublished);
      socket.off(SocketEvent.ScheduleUnpublished);
      socket.off(SocketEvent.ShiftUpdated);
      socket.off(SocketEvent.AssignmentCreated);
      socket.off(SocketEvent.AssignmentRemoved);
      socket.off(SocketEvent.AssignmentConflict);
      socket.off(SocketEvent.SwapCreated);
      socket.off(SocketEvent.SwapResolved);
      socket.off(SocketEvent.OnDutyUpdated);
      socket.off(SocketEvent.NotificationNew);
    };
  }, [accessToken, queryClient]);
}
