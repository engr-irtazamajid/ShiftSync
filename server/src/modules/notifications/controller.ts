import { Request, Response } from "express";
import { z } from "zod";
import { NotificationType } from "@shiftsync/shared";
import { NotificationModel } from "../../models/Notification";
import { NotificationPreferenceModel } from "../../models/NotificationPreference";
import { AppError } from "../../middleware/AppError";
import { toNotificationDTO, toNotificationPreferenceDTO } from "./mapper";

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const filter: Record<string, unknown> = { userId: req.user!.id };
  if (req.query.unreadOnly === "true") filter.readAt = null;

  const notifications = await NotificationModel.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json({ notifications: notifications.map(toNotificationDTO) });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const notification = await NotificationModel.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!.id },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  res.json({ notification: toNotificationDTO(notification) });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  await NotificationModel.updateMany(
    { userId: req.user!.id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  res.status(204).send();
}

const preferenceSchema = z.object({
  emailSimEnabled: z.boolean(),
  mutedTypes: z.array(z.nativeEnum(NotificationType)),
});

export async function getPreferences(req: Request, res: Response): Promise<void> {
  let preference = await NotificationPreferenceModel.findOne({ userId: req.user!.id });
  if (!preference) {
    preference = await NotificationPreferenceModel.create({
      userId: req.user!.id,
      emailSimEnabled: false,
      mutedTypes: [],
    });
  }
  res.json({ preference: toNotificationPreferenceDTO(preference) });
}

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  const body = preferenceSchema.parse(req.body);
  const preference = await NotificationPreferenceModel.findOneAndUpdate(
    { userId: req.user!.id },
    { $set: body },
    { new: true, upsert: true }
  );
  res.json({ preference: toNotificationPreferenceDTO(preference) });
}
