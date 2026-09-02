import { AssignmentDTO } from "@shiftsync/shared";
import { AssignmentDocument } from "../../models/Assignment";

export function toAssignmentDTO(a: AssignmentDocument): AssignmentDTO {
  return {
    id: a.id.toString(),
    shiftId: a.shiftId.toString(),
    staffId: a.staffId.toString(),
    status: a.status,
    version: a.version,
    assignedBy: a.assignedBy.toString(),
    assignedAt: a.assignedAt.toISOString(),
    releasedAt: a.releasedAt ? a.releasedAt.toISOString() : null,
    releasedReason: a.releasedReason,
  };
}
