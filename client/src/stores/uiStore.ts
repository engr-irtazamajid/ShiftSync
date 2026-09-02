import { create } from "zustand";

interface UiState {
  selectedLocationId: string | null;
  selectedWeekKey: string | null;
  setSelectedLocationId: (id: string | null) => void;
  setSelectedWeekKey: (key: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedLocationId: null,
  selectedWeekKey: null,
  setSelectedLocationId: (id) => set({ selectedLocationId: id }),
  setSelectedWeekKey: (key) => set({ selectedWeekKey: key }),
}));
