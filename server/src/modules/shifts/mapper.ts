import { ShiftDTO } from "@shiftsync/shared";
import { ShiftDocument } from "../../models/Shift";

export function toShiftDTO(shift: ShiftDocument): ShiftDTO {
  return {
    id: shift.id.toString(),
    locationId: shift.locationId.toString(),
    requiredSkillId: shift.requiredSkillId.toString(),
    startUtc: shift.startUtc.toISOString(),
    endUtc: shift.endUtc.toISOString(),
    headcount: shift.headcount,
    status: shift.status,
    weekKey: shift.weekKey,
    notes: shift.notes,
    version: shift.version,
    createdBy: shift.createdBy.toString(),
    updatedBy: shift.updatedBy.toString(),
    isPremium: shift.isPremium,
  };
}
