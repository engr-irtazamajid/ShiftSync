import { Request, Response } from "express";
import { z } from "zod";
import { SkillDTO } from "@shiftsync/shared";
import { SkillModel, SkillDocument } from "../../models/Skill";
import { AppError } from "../../middleware/AppError";

const createSchema = z.object({ name: z.string().min(1) });
const updateSchema = createSchema.partial();

function toSkillDTO(skill: SkillDocument): SkillDTO {
  return { id: skill.id.toString(), name: skill.name };
}

export async function listSkills(_req: Request, res: Response): Promise<void> {
  const skills = await SkillModel.find().sort({ name: 1 });
  res.json({ skills: skills.map(toSkillDTO) });
}

export async function createSkill(req: Request, res: Response): Promise<void> {
  const body = createSchema.parse(req.body);
  const skill = await SkillModel.create(body);
  res.status(201).json({ skill: toSkillDTO(skill) });
}

export async function updateSkill(req: Request, res: Response): Promise<void> {
  const body = updateSchema.parse(req.body);
  const skill = await SkillModel.findByIdAndUpdate(req.params.id, body, { new: true });
  if (!skill) throw new AppError(404, "SKILL_NOT_FOUND", "Skill not found");
  res.json({ skill: toSkillDTO(skill) });
}
