export interface LocationDTO {
  id: string;
  name: string;
  timezone: string;
  address: string | null;
  isActive: boolean;
}

export interface SkillDTO {
  id: string;
  name: string;
}
