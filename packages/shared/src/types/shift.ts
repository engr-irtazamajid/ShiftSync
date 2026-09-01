import { ShiftStatus } from "../enums";

export interface ShiftDTO {
  id: string;
  locationId: string;
  requiredSkillId: string;
  startUtc: string;
  endUtc: string;
  headcount: number;
  status: ShiftStatus;
  weekKey: string;
  notes: string | null;
  version: number;
  createdBy: string;
  updatedBy: string;
  isPremium: boolean;
}
