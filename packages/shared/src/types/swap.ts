import { SwapStatus, SwapType } from "../enums";

export interface SwapRequestDTO {
  id: string;
  type: SwapType;
  assignmentId: string;
  requestedBy: string;
  targetStaffId: string | null;
  claimedBy: string | null;
  status: SwapStatus;
  managerDecisionBy: string | null;
  managerDecisionAt: string | null;
  managerDecisionReason: string | null;
  expiresAt: string | null;
  autoCancelledReason: string | null;
  createdAt: string;
}
