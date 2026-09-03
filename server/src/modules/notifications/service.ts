import { ClientSession, Types } from "mongoose";
import { NotificationChannel, NotificationDTO, NotificationType } from "@shiftsync/shared";
import { NotificationModel, NotificationDocument } from "../../models/Notification";
import { NotificationPreferenceModel } from "../../models/NotificationPreference";
import { emitNotificationNew } from "../../sockets/emitters";
import { toNotificationDTO } from "./mapper";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  session?: ClientSession;
}

/**
 * Returns the created notification document (or null if muted) so callers running
 * inside a transaction can defer the real-time emit until after commit, using
 * emitCreatedNotification below. Callers outside a transaction get the emit for free.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationDocument | null> {
  const preference = await NotificationPreferenceModel.findOne({ userId: input.userId }).session(
    input.session ?? null
  );

  if (preference?.mutedTypes.includes(input.type)) return null;

  const channel = preference?.emailSimEnabled
    ? NotificationChannel.InAppAndEmailSim
    : NotificationChannel.InApp;

  const [notification] = await NotificationModel.create(
    [
      {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ? new Types.ObjectId(input.relatedEntityId) : null,
        channel,
      },
    ],
    { session: input.session ?? undefined }
  );

  if (channel === NotificationChannel.InAppAndEmailSim) {
    // eslint-disable-next-line no-console
    console.log(`[simulated email] to user ${input.userId}: ${input.title} — ${input.body}`);
  }

  // Only emit post-commit-safe events outside a transaction; callers inside a
  // transaction should defer real-time emission until after commit themselves,
  // via emitCreatedNotification.
  if (!input.session) {
    emitNotificationNew(input.userId, toNotificationDTO(notification));
  }

  return notification;
}

export function emitCreatedNotification(notification: NotificationDocument | null): void {
  if (!notification) return;
  emitNotificationNew(
    notification.userId.toString(),
    toNotificationDTO(notification) as NotificationDTO
  );
}
