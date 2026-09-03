import { useEffect } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import type { UserDTO } from "@shiftsync/shared";
import { apiClient } from "./client";
import { useAuthStore } from "@/stores/authStore";

interface LoginResponse {
  accessToken: string;
  user: UserDTO;
}

export function useAuthBootstrap() {
  const setSession = useAuthStore((state) => state.setSession);
  const setBootstrapping = useAuthStore((state) => state.setBootstrapping);

  useEffect(() => {
    let cancelled = false;

    axios
      .post<LoginResponse>(
        `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
        {},
        { withCredentials: true }
      )
      .then((response) => {
        if (!cancelled) {
          setSession(response.data.user, response.data.accessToken);
        }
      })
      .catch(() => {
        // no valid refresh cookie present — user is simply logged out
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const response = await apiClient.post<LoginResponse>("/api/auth/login", payload);
      return response.data;
    },
    onSuccess: (data) => {
      setSession(data.user, data.accessToken);
    },
  });
}

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation({
    mutationFn: async () => {
      await apiClient.post("/api/auth/logout");
    },
    onSuccess: () => {
      clearSession();
    },
  });
}
