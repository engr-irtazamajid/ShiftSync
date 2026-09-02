import { NotificationType, Role } from "@shiftsync/shared";
import { CertificationModel } from "../../models/Certification";
import { UserModel } from "../../models/User";
import { createNotification } from "../notifications/service";

export async function notifyManagersOfAvailabilityChange(staffId: string): Promise<void> {
  const staff = await UserModel.findById(staffId);
  if (!staff) return;

  const certifications = await CertificationModel.find({ staffId, revokedAt: null }).distinct("locationId");
  if (certifications.length === 0) return;

  const recipients = await UserModel.find({
    $or: [
      { role: Role.Admin },
      { role: Role.Manager, managedLocationIds: { $in: certifications } },
    ],
  });

  for (const recipient of recipients) {
    await createNotification({
      userId: recipient.id.toString(),
      type: NotificationType.AvailabilityChanged,
      title: "Staff availability changed",
      body: `${staff.firstName} ${staff.lastName} updated their availability.`,
      relatedEntityType: "user",
      relatedEntityId: staff.id.toString(),
    });
  }
}
