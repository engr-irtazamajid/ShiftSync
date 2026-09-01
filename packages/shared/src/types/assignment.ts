import { AssignmentStatus } from "../enums";
import { ShiftDTO } from "./shift";

export interface AssignmentDTO {
  id: string;
  shiftId: string;
  staffId: string;
  status: AssignmentStatus;
  version: number;
  assignedBy: string;
  assignedAt: string;
  releasedAt: string | null;
  releasedReason: string | null;
}

export interface AssignmentWithShiftDTO extends AssignmentDTO {
  shift: ShiftDTO;
}
