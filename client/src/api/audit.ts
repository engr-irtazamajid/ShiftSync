import { useQuery } from "@tanstack/react-query";
import type { AuditLogDTO } from "@shiftsync/shared";
import { apiClient } from "./client";

export function useAuditLog(params: { entityType?: string; entityId?: string; locationId?: string; from?: string; to?: string }) {
  return useQuery({
    queryKey: ["audit", params],
    queryFn: async () => {
      const response = await apiClient.get<{ auditLogs: AuditLogDTO[] }>("/api/audit", { params });
      return response.data.auditLogs;
    },
  });
}
