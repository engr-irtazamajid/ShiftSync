import { NotificationChannel, NotificationType } from "../enums";

export interface NotificationDTO {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  readAt: string | null;
  channel: NotificationChannel;
  createdAt: string;
}

export interface NotificationPreferenceDTO {
  userId: string;
  emailSimEnabled: boolean;
  mutedTypes: NotificationType[];
}
