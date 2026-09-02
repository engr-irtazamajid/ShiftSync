import { NotificationType } from "@shiftsync/shared";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/api/notifications";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.ShiftAssigned]: "New shift assigned",
  [NotificationType.ShiftChanged]: "Shift changed",
  [NotificationType.ShiftUnassigned]: "Shift unassigned",
  [NotificationType.SwapRequested]: "Swap request updates",
  [NotificationType.SwapResolved]: "Swap resolved",
  [NotificationType.DropAvailable]: "Drop shift available",
  [NotificationType.SchedulePublished]: "Schedule published",
  [NotificationType.OvertimeWarning]: "Overtime warning",
  [NotificationType.AvailabilityChanged]: "Staff availability changed",
  [NotificationType.ApprovalNeeded]: "Approval needed",
};

export function NotificationSettingsPage() {
  const { data: preferences } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  if (!preferences) return null;

  const mutedSet = new Set(preferences.mutedTypes);

  function toggleType(type: NotificationType) {
    if (!preferences) return;
    const nextMuted = mutedSet.has(type)
      ? preferences.mutedTypes.filter((t) => t !== type)
      : [...preferences.mutedTypes, type];
    updatePreferences.mutate({ emailSimEnabled: preferences.emailSimEnabled, mutedTypes: nextMuted });
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Notification settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>Choose how you receive notifications.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">In-app + simulated email</p>
            <p className="text-sm text-muted-foreground">
              When enabled, notifications are also logged as a simulated email.
            </p>
          </div>
          <Switch
            checked={preferences.emailSimEnabled}
            onCheckedChange={(checked) =>
              updatePreferences.mutate({ emailSimEnabled: checked, mutedTypes: preferences.mutedTypes })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification types</CardTitle>
          <CardDescription>Turn off types you don't want to be notified about.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <Switch
                checked={!mutedSet.has(type as NotificationType)}
                onCheckedChange={() => toggleType(type as NotificationType)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
