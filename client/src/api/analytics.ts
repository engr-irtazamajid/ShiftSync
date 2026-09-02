import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface HoursDistributionEntry {
  staffId: string;
  name: string;
  totalHours: number;
  premiumHours: number;
}

export interface FairnessEntry {
  staffId: string;
  name: string;
  premiumHours: number;
}

export interface FairnessReport {
  entries: FairnessEntry[];
  equityScore: number;
  formula: string;
}

export interface UnderOverEntry {
  staffId: string;
  name: string;
  desiredWeeklyHours: number | null;
  actualHours: number;
  delta: number;
}

export interface OtDashboardEntry {
  staffId: string;
  name: string;
  projectedWeeklyHours: number;
  projectedOvertimeHours: number;
  projectedOvertimeCost: number;
  status: "ok" | "warn" | "block";
}

export interface OnDutyEntry {
  staffId: string;
  name: string;
  shiftId: string;
  startUtc: string;
  endUtc: string;
}

export function useHoursDistribution(params: { locationId?: string; weekKey?: string }) {
  return useQuery({
    queryKey: ["analytics", "hours-distribution", params],
    queryFn: async () => {
      const response = await apiClient.get<{ entries: HoursDistributionEntry[] }>(
        "/api/analytics/hours-distribution",
        { params }
      );
      return response.data.entries;
    },
    enabled: Boolean(params.weekKey),
  });
}

export function useFairness(params: { locationId?: string; weekKey?: string }) {
  return useQuery({
    queryKey: ["analytics", "fairness", params],
    queryFn: async () => {
      const response = await apiClient.get<FairnessReport>("/api/analytics/fairness", { params });
      return response.data;
    },
    enabled: Boolean(params.weekKey),
  });
}

export function useUnderOverScheduled(params: { locationId?: string; weekKey?: string }) {
  return useQuery({
    queryKey: ["analytics", "under-over-scheduled", params],
    queryFn: async () => {
      const response = await apiClient.get<{ entries: UnderOverEntry[] }>(
        "/api/analytics/under-over-scheduled",
        { params }
      );
      return response.data.entries;
    },
    enabled: Boolean(params.weekKey),
  });
}

export function useOtDashboard(params: { locationId?: string; weekKey?: string }) {
  return useQuery({
    queryKey: ["analytics", "ot-dashboard", params],
    queryFn: async () => {
      const response = await apiClient.get<{ entries: OtDashboardEntry[] }>("/api/analytics/ot-dashboard", {
        params,
      });
      return response.data.entries;
    },
    enabled: Boolean(params.weekKey),
  });
}

export function useOnDutyNow(locationId: string | undefined) {
  return useQuery({
    queryKey: ["on-duty-now", locationId],
    queryFn: async () => {
      const response = await apiClient.get<{ entries: OnDutyEntry[] }>("/api/analytics/on-duty-now", {
        params: { locationId },
      });
      return response.data.entries;
    },
    enabled: Boolean(locationId),
    refetchInterval: 60_000,
  });
}
