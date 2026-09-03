import { useInfiniteQuery } from "@tanstack/react-query";
import type { AuditLogPageDTO } from "@shiftsync/shared";
import { apiClient } from "./client";

export function useAuditLog(params: {
  entityType?: string;
  entityId?: string;
  locationId?: string;
  from?: string;
  to?: string;
}) {
  return useInfiniteQuery({
    queryKey: ["audit", params],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const response = await apiClient.get<AuditLogPageDTO>("/api/audit", {
        params: { ...params, cursor: pageParam },
      });
      return response.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
