import { SwapRequestDTO } from "@shiftsync/shared";
import { SwapRequestDocument } from "../../models/SwapRequest";

export function toSwapRequestDTO(s: SwapRequestDocument): SwapRequestDTO {
  return {
    id: s.id.toString(),
    type: s.type,
    assignmentId: s.assignmentId.toString(),
    requestedBy: s.requestedBy.toString(),
    targetStaffId: s.targetStaffId ? s.targetStaffId.toString() : null,
    claimedBy: s.claimedBy ? s.claimedBy.toString() : null,
    status: s.status,
    managerDecisionBy: s.managerDecisionBy ? s.managerDecisionBy.toString() : null,
    managerDecisionAt: s.managerDecisionAt ? s.managerDecisionAt.toISOString() : null,
    managerDecisionReason: s.managerDecisionReason,
    expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
    autoCancelledReason: s.autoCancelledReason,
    createdAt: s.createdAt.toISOString(),
  };
}
