import { create } from "zustand";
import type { UserDTO } from "@shiftsync/shared";

interface AuthState {
  user: UserDTO | null;
  accessToken: string | null;
  isBootstrapping: boolean;
  setSession: (user: UserDTO, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setBootstrapping: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isBootstrapping: true,
  setSession: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ user: null, accessToken: null }),
  setBootstrapping: (value) => set({ isBootstrapping: value }),
}));
