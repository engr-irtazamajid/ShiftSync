import { useEffect } from "react";
import { useLocations } from "@/api/locations";
import { useFairness, useUnderOverScheduled } from "@/api/analytics";
import { useUiStore } from "@/stores/uiStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { currentWeekKey, weekKeyLabel } from "@/lib/time";

export function FairnessPage() {
  const { data: locations = [] } = useLocations();
  const { selectedLocationId, setSelectedLocationId } = useUiStore();

  useEffect(() => {
    if (!selectedLocationId && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId, setSelectedLocationId]);

  const currentLocation = locations.find((l) => l.id === selectedLocationId);
  const weekKey = currentLocation ? currentWeekKey(currentLocation.timezone) : "";

  const { data: fairness } = useFairness({ locationId: selectedLocationId ?? undefined, weekKey });
  const { data: underOver = [] } = useUnderOverScheduled({
    locationId: selectedLocationId ?? undefined,
    weekKey,
  });

  const maxPremiumHours = Math.max(1, ...(fairness?.entries ?? []).map((e) => e.premiumHours));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Schedule fairness</h1>
        <Select value={selectedLocationId ?? undefined} onValueChange={setSelectedLocationId}>
          <SelectTrigger className="h-8 w-48 text-sm">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Premium shifts{" "}
              {currentLocation && weekKey && `· ${weekKeyLabel(weekKey, currentLocation.timezone)}`}
            </CardTitle>
            {fairness && (
              <Badge
                variant={fairness.equityScore >= 70 ? "success" : "warning"}
                className="font-normal"
              >
                {fairness.equityScore.toFixed(0)}/100
              </Badge>
            )}
          </CardHeader>
          <CardContent className="max-h-[28rem] space-y-1.5 overflow-y-auto pt-0">
            {(fairness?.entries ?? []).map((entry) => (
              <div key={entry.staffId} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate">{entry.name}</span>
                <div className="h-1.5 flex-1 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary/70"
                    style={{ width: `${(entry.premiumHours / maxPremiumHours) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                  {entry.premiumHours.toFixed(1)}h
                </span>
              </div>
            ))}
            {(fairness?.entries ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No premium shifts this week.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Under / over-scheduled
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[28rem] space-y-1 overflow-y-auto pt-0">
            {underOver.map((entry) => (
              <div key={entry.staffId} className="flex items-center justify-between text-sm">
                <span className="truncate">{entry.name}</span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {entry.actualHours.toFixed(1)}h
                    {entry.desiredWeeklyHours != null && ` / ${entry.desiredWeeklyHours}h`}
                  </span>
                  {entry.delta !== 0 && (
                    <span
                      className={
                        entry.delta < 0
                          ? "rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900"
                          : "rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground"
                      }
                    >
                      {entry.delta > 0 ? "+" : ""}
                      {entry.delta.toFixed(1)}h
                    </span>
                  )}
                </span>
              </div>
            ))}
            {underOver.length === 0 && (
              <p className="text-sm text-muted-foreground">No data for this week yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
