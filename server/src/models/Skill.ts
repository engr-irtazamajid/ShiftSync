import { Schema, model, HydratedDocument } from "mongoose";

export interface SkillShape {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SkillDocument = HydratedDocument<SkillShape>;

const skillSchema = new Schema<SkillShape>(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

export const SkillModel = model<SkillShape>("Skill", skillSchema);
