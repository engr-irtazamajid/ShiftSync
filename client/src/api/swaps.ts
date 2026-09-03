import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConstraintCheckResult, SwapRequestDTO } from "@shiftsync/shared";
import { apiClient } from "./client";
import { toast } from "@/stores/toastStore";

interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { result?: ConstraintCheckResult; [key: string]: unknown };
  };
}

export function extractErrorMessage(error: unknown): string {
  const err = error as { response?: { data?: ApiErrorBody } };
  const body = err?.response?.data?.error;
  if (!body) return "Something went wrong. Please try again.";

  const blockingViolation = body.details?.result?.violations?.find((v) => v.severity === "block");
  if (blockingViolation) return blockingViolation.message;

  return body.message || "Something went wrong. Please try again.";
}

export function useSwaps(
  params: {
    requestedBy?: string;
    targetStaffId?: string;
    status?: string;
    type?: string;
  } = {}
) {
  return useQuery({
    queryKey: ["swaps", params.requestedBy, params.targetStaffId, params.status, params.type],
    queryFn: async () => {
      const response = await apiClient.get<{ swapRequests: SwapRequestDTO[] }>("/api/swaps", {
        params,
      });
      return response.data.swapRequests;
    },
  });
}

export function useCreateSwap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      type: "swap" | "drop";
      assignmentId: string;
      targetStaffId?: string;
    }) => {
      const response = await apiClient.post<{ swapRequest: SwapRequestDTO }>("/api/swaps", payload);
      return response.data.swapRequest;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["swaps"] }),
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Couldn't submit request",
        description: extractErrorMessage(error),
      });
    },
  });
}

const ACTION_LABELS: Record<string, string> = {
  accept: "accept this swap",
  reject: "reject this swap",
  claim: "claim this shift",
  withdraw: "withdraw this request",
  approve: "approve this request",
  deny: "deny this request",
};

function useSwapAction(action: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body?: Record<string, unknown> }) => {
      const response = await apiClient.post<{ swapRequest: SwapRequestDTO }>(
        `/api/swaps/${id}/${action}`,
        body ?? {}
      );
      return response.data.swapRequest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swaps"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: `Couldn't ${ACTION_LABELS[action] ?? "complete this action"}`,
        description: extractErrorMessage(error),
      });
    },
  });
}

export function useAcceptSwap() {
  return useSwapAction("accept");
}
export function useRejectSwap() {
  return useSwapAction("reject");
}
export function useClaimDrop() {
  return useSwapAction("claim");
}
export function useWithdrawSwap() {
  return useSwapAction("withdraw");
}
export function useApproveSwap() {
  return useSwapAction("approve");
}
export function useDenySwap() {
  return useSwapAction("deny");
}
