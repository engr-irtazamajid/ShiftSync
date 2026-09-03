import type { NotificationDTO } from "@shiftsync/shared";

export function resolveNotificationLink(notification: NotificationDTO): string | null {
  switch (notification.relatedEntityType) {
    case "shift":
      return notification.relatedEntityId ? `/shifts/${notification.relatedEntityId}` : null;
    case "swap_request":
      return "/swaps";
    case "user":
      return notification.relatedEntityId
        ? `/staff/${notification.relatedEntityId}/availability`
        : null;
    default:
      return null;
  }
}
