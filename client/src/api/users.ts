import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AvailabilityDTO, CertificationDTO, UserDTO } from "@shiftsync/shared";
import { apiClient } from "./client";

export function useUsers(params: { role?: string; locationId?: string; skillId?: string } = {}) {
  return useQuery({
    queryKey: ["users", params.role, params.locationId, params.skillId],
    queryFn: async () => {
      const response = await apiClient.get<{ users: UserDTO[] }>("/api/users", { params });
      return response.data.users;
    },
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: async () => {
      const response = await apiClient.get<{ user: UserDTO }>(`/api/users/${id}`);
      return response.data.user;
    },
    enabled: Boolean(id),
  });
}

export function useUserCertifications(id: string | undefined) {
  return useQuery({
    queryKey: ["certifications", id],
    queryFn: async () => {
      const response = await apiClient.get<{ certifications: CertificationDTO[] }>(
        `/api/users/${id}/certifications`
      );
      return response.data.certifications;
    },
    enabled: Boolean(id),
  });
}

export function useUserAvailability(id: string | undefined) {
  return useQuery({
    queryKey: ["availability", id],
    queryFn: async () => {
      const response = await apiClient.get<{ availability: AvailabilityDTO[] }>(
        `/api/users/${id}/availability`
      );
      return response.data.availability;
    },
    enabled: Boolean(id),
  });
}

export function useReplaceAvailability(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      entries: Array<Pick<AvailabilityDTO, "dayOfWeek" | "startLocalTime" | "endLocalTime">>
    ) => {
      await apiClient.put(`/api/users/${userId}/availability`, { entries });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability", userId] });
    },
  });
}

export function useAddAvailabilityException(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      exceptionDate: string;
      exceptionStartLocalTime?: string;
      exceptionEndLocalTime?: string;
      isUnavailable: boolean;
    }) => {
      await apiClient.post(`/api/users/${userId}/availability/exceptions`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability", userId] });
    },
  });
}
