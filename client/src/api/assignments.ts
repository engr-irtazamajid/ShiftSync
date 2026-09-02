import { useQuery } from "@tanstack/react-query";
import type { AssignmentDTO } from "@shiftsync/shared";
import { apiClient } from "./client";

export function useAssignmentsForShifts(shiftIds: string[]) {
  return useQuery({
    queryKey: ["assignments", shiftIds],
    queryFn: async () => {
      const response = await apiClient.get<AssignmentDTO[]>("/api/assignments", {
        params: { shiftIds: shiftIds.join(",") },
      });
      return response.data;
    },
    enabled: shiftIds.length > 0,
  });
}

export function useShiftAssignments(shiftId: string | undefined) {
  return useQuery({
    queryKey: ["assignments", "shift", shiftId],
    queryFn: async () => {
      const response = await apiClient.get<AssignmentDTO[]>("/api/assignments", {
        params: { shiftId },
      });
      return response.data;
    },
    enabled: Boolean(shiftId),
  });
}

export function useAssignmentsByIds(ids: string[]) {
  return useQuery({
    queryKey: ["assignments", "byIds", ids],
    queryFn: async () => {
      const response = await apiClient.get<AssignmentDTO[]>("/api/assignments", {
        params: { ids: ids.join(",") },
      });
      return response.data;
    },
    enabled: ids.length > 0,
  });
}
