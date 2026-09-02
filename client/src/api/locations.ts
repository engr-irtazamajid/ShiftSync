import { useQuery } from "@tanstack/react-query";
import type { LocationDTO, SkillDTO } from "@shiftsync/shared";
import { apiClient } from "./client";

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await apiClient.get<{ locations: LocationDTO[] }>("/api/locations");
      return response.data.locations;
    },
  });
}

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: async () => {
      const response = await apiClient.get<{ skills: SkillDTO[] }>("/api/skills");
      return response.data.skills;
    },
  });
}
