import { Schema, model, Types, HydratedDocument } from "mongoose";
import { Role } from "@shiftsync/shared";

export interface UserShape {
  email: string;
  passwordHash: string;
  role: Role;
  firstName: string;
  lastName: string;
  isActive: boolean;
  managedLocationIds: Types.ObjectId[];
  skillIds: Types.ObjectId[];
  desiredWeeklyHours: number | null;
  refreshTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserShape>;

const userSchema = new Schema<UserShape>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(Role), required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    managedLocationIds: [{ type: Schema.Types.ObjectId, ref: "Location", default: [] }],
    skillIds: [{ type: Schema.Types.ObjectId, ref: "Skill", default: [] }],
    desiredWeeklyHours: { type: Number, default: null },
    refreshTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ managedLocationIds: 1 });
userSchema.index({ skillIds: 1 });

export const UserModel = model<UserShape>("User", userSchema);
