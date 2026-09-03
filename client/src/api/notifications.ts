import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationDTO, NotificationPreferenceDTO } from "@shiftsync/shared";
import { apiClient } from "./client";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await apiClient.get<{ notifications: NotificationDTO[] }>(
        "/api/notifications"
      );
      return response.data.notifications;
    },
    select: (notifications) => notifications.filter(Boolean),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.patch("/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const response = await apiClient.get<{ preference: NotificationPreferenceDTO }>(
        "/api/notification-preferences"
      );
      return response.data.preference;
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      emailSimEnabled: boolean;
      mutedTypes: NotificationPreferenceDTO["mutedTypes"];
    }) => {
      const response = await apiClient.put<{ preference: NotificationPreferenceDTO }>(
        "/api/notification-preferences",
        payload
      );
      return response.data.preference;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}
