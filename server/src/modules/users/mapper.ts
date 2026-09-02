import { UserDTO, CertificationDTO, AvailabilityDTO } from "@shiftsync/shared";
import { UserDocument } from "../../models/User";
import { CertificationDocument } from "../../models/Certification";
import { AvailabilityDocument } from "../../models/Availability";

export function toUserDTO(user: UserDocument): UserDTO {
  return {
    id: user.id.toString(),
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    managedLocationIds: user.managedLocationIds.map((id) => id.toString()),
    skillIds: user.skillIds.map((id) => id.toString()),
    desiredWeeklyHours: user.desiredWeeklyHours,
  };
}

export function toCertificationDTO(cert: CertificationDocument): CertificationDTO {
  return {
    id: cert.id.toString(),
    staffId: cert.staffId.toString(),
    locationId: cert.locationId.toString(),
    certifiedAt: cert.certifiedAt.toISOString(),
    revokedAt: cert.revokedAt ? cert.revokedAt.toISOString() : null,
    revokedReason: cert.revokedReason,
  };
}

export function toAvailabilityDTO(a: AvailabilityDocument): AvailabilityDTO {
  return {
    id: a.id.toString(),
    staffId: a.staffId.toString(),
    type: a.type,
    dayOfWeek: a.dayOfWeek,
    startLocalTime: a.startLocalTime,
    endLocalTime: a.endLocalTime,
    exceptionDate: a.exceptionDate,
    exceptionStartLocalTime: a.exceptionStartLocalTime,
    exceptionEndLocalTime: a.exceptionEndLocalTime,
    isUnavailable: a.isUnavailable,
  };
}
