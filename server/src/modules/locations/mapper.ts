import { LocationDTO } from "@shiftsync/shared";
import { LocationDocument } from "../../models/Location";

export function toLocationDTO(loc: LocationDocument): LocationDTO {
  return {
    id: loc.id.toString(),
    name: loc.name,
    timezone: loc.timezone,
    address: loc.address,
    isActive: loc.isActive,
  };
}
