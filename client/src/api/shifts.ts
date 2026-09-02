import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AssignmentPreviewResult, AuditLogDTO, ConstraintCheckResult, ShiftDTO } from "@shiftsync/shared";
import { apiClient } from "./client";

export function useShifts(params: { locationId?: string; weekKey?: string; status?: string }) {
  return useQuery({
    queryKey: ["shifts", params.locationId, params.weekKey, params.status],
    queryFn: async () => {
      const response = await apiClient.get<{ shifts: ShiftDTO[] }>("/api/shifts", { params });
      return response.data.shifts;
    },
    enabled: Boolean(params.locationId && params.weekKey),
  });
}

export function useShiftsByIds(ids: string[]) {
  return useQuery({
    queryKey: ["shifts", "byIds", ids],
    queryFn: async () => {
      const response = await apiClient.get<{ shifts: ShiftDTO[] }>("/api/shifts", {
        params: { ids: ids.join(",") },
      });
      return response.data.shifts;
    },
    enabled: ids.length > 0,
  });
}

export function useShift(id: string | undefined) {
  return useQuery({
    queryKey: ["shift", id],
    queryFn: async () => {
      const response = await apiClient.get<{ shift: ShiftDTO }>(`/api/shifts/${id}`);
      return response.data.shift;
    },
    enabled: Boolean(id),
  });
}

export function useShiftHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["shift-history", id],
    queryFn: async () => {
      const response = await apiClient.get<{ auditLogs: AuditLogDTO[] }>(`/api/shifts/${id}/history`);
      return response.data.auditLogs;
    },
    enabled: Boolean(id),
  });
}

export interface CreateShiftPayload {
  locationId: string;
  requiredSkillId: string;
  startUtc: string;
  endUtc: string;
  headcount: number;
  notes?: string;
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateShiftPayload) => {
      const response = await apiClient.post<{ shift: ShiftDTO }>("/api/shifts", payload);
      return response.data.shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function usePublishSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { locationId: string; weekKey: string }) => {
      await apiClient.post("/api/shifts/publish", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function useUnpublishSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { locationId: string; weekKey: string }) => {
      await apiClient.post("/api/shifts/unpublish", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export interface AssignPayload {
  shiftId: string;
  staffId: string;
  expectedShiftVersion: number;
  allowManagerOverride?: boolean;
  overrideReason?: string;
}

export function usePreviewAssignment() {
  return useMutation({
    mutationFn: async (payload: { shiftId: string; staffId: string }) => {
      const response = await apiClient.post<AssignmentPreviewResult>(
        `/api/shifts/${payload.shiftId}/preview-assignment`,
        { staffId: payload.staffId }
      );
      return response.data;
    },
  });
}

export function useAssignStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AssignPayload) => {
      const response = await apiClient.post<{ assignment: unknown; shift: ShiftDTO }>(
        `/api/shifts/${payload.shiftId}/assign`,
        {
          staffId: payload.staffId,
          expectedShiftVersion: payload.expectedShiftVersion,
          allowManagerOverride: payload.allowManagerOverride,
          overrideReason: payload.overrideReason,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

export function useUnassignStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { assignmentId: string; reason?: string }) => {
      await apiClient.delete(`/api/assignments/${input.assignmentId}`, {
        data: { reason: input.reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
}

interface ApiErrorBody {
  error: { code: string; message: string; details?: { result?: ConstraintCheckResult; [key: string]: unknown } };
}

export function isConstraintViolationError(
  error: unknown
): error is { response: { status: 422; data: ApiErrorBody } } {
  const err = error as { response?: { status?: number; data?: ApiErrorBody } };
  return err?.response?.status === 422 && err.response.data?.error?.code === "CONSTRAINT_VIOLATION";
}

export function getConstraintResult(error: unknown): ConstraintCheckResult | undefined {
  if (!isConstraintViolationError(error)) return undefined;
  return error.response.data.error.details?.result;
}

export function isConflictError(
  error: unknown
): error is { response: { status: 409; data: ApiErrorBody } } {
  const err = error as { response?: { status?: number } };
  return err?.response?.status === 409;
}

export function getConflictCode(error: unknown): string | undefined {
  if (!isConflictError(error)) return undefined;
  return error.response.data.error.code;
}
