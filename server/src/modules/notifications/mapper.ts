import { NotificationDTO, NotificationPreferenceDTO } from "@shiftsync/shared";
import { NotificationDocument } from "../../models/Notification";
import { NotificationPreferenceDocument } from "../../models/NotificationPreference";

export function toNotificationDTO(n: NotificationDocument): NotificationDTO {
  return {
    id: n.id.toString(),
    userId: n.userId.toString(),
    type: n.type,
    title: n.title,
    body: n.body,
    relatedEntityType: n.relatedEntityType,
    relatedEntityId: n.relatedEntityId ? n.relatedEntityId.toString() : null,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    channel: n.channel,
    createdAt: n.createdAt.toISOString(),
  };
}

export function toNotificationPreferenceDTO(p: NotificationPreferenceDocument): NotificationPreferenceDTO {
  return {
    userId: p.userId.toString(),
    emailSimEnabled: p.emailSimEnabled,
    mutedTypes: p.mutedTypes,
  };
}
