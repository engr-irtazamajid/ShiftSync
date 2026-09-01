import { Role } from "../enums";

export interface UserDTO {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  isActive: boolean;
  managedLocationIds: string[];
  skillIds: string[];
  desiredWeeklyHours: number | null;
}

export interface CertificationDTO {
  id: string;
  staffId: string;
  locationId: string;
  certifiedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
}

export interface AvailabilityDTO {
  id: string;
  staffId: string;
  type: "recurring" | "exception";
  dayOfWeek: number | null;
  startLocalTime: string | null;
  endLocalTime: string | null;
  exceptionDate: string | null;
  exceptionStartLocalTime: string | null;
  exceptionEndLocalTime: string | null;
  isUnavailable: boolean;
}
