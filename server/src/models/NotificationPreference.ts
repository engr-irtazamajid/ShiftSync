import { Schema, model, Types, HydratedDocument } from "mongoose";
import { NotificationType } from "@shiftsync/shared";

export interface NotificationPreferenceShape {
  userId: Types.ObjectId;
  emailSimEnabled: boolean;
  mutedTypes: NotificationType[];
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationPreferenceDocument = HydratedDocument<NotificationPreferenceShape>;

const notificationPreferenceSchema = new Schema<NotificationPreferenceShape>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    emailSimEnabled: { type: Boolean, default: false },
    mutedTypes: [{ type: String, enum: Object.values(NotificationType), default: [] }],
  },
  { timestamps: true }
);

export const NotificationPreferenceModel = model<NotificationPreferenceShape>(
  "NotificationPreference",
  notificationPreferenceSchema
);
