import { Schema, model, Types, HydratedDocument } from "mongoose";
import { NotificationChannel, NotificationType } from "@shiftsync/shared";

export interface NotificationShape {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: Types.ObjectId | null;
  readAt: Date | null;
  channel: NotificationChannel;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDocument = HydratedDocument<NotificationShape>;

const notificationSchema = new Schema<NotificationShape>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    relatedEntityType: { type: String, default: null },
    relatedEntityId: { type: Schema.Types.ObjectId, default: null },
    readAt: { type: Date, default: null },
    channel: {
      type: String,
      enum: Object.values(NotificationChannel),
      default: NotificationChannel.InApp,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const NotificationModel = model<NotificationShape>("Notification", notificationSchema);
