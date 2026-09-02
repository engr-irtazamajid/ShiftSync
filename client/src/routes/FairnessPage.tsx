import { useEffect, useState } from "react";
import { useLocations } from "@/api/locations";
import { useFairness, useUnderOverScheduled } from "@/api/analytics";
import { useUiStore } from "@/stores/uiStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { currentWeekKey, weekKeyLabel } from "@/lib/time";

export function FairnessPage() {
  const { data: locations = [] } = useLocations();
  const { selectedLocationId, setSelectedLocationId } = useUiStore();
  const [weekKey, setWeekKey] = useState("");

  useEffect(() => {
    if (!selectedLocationId && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId, setSelectedLocationId]);

  useEffect(() => {
    if (!weekKey && selectedLocationId) {
      const location = locations.find((l) => l.id === selectedLocationId);
      setWeekKey(currentWeekKey(location?.timezone ?? "UTC"));
    }
  }, [selectedLocationId, locations, weekKey]);

  const currentLocation = locations.find((l) => l.id === selectedLocationId);

  const { data: fairness } = useFairness({ locationId: selectedLocationId ?? undefined, weekKey });
  const { data: underOver = [] } = useUnderOverScheduled({
    locationId: selectedLocationId ?? undefined,
    weekKey,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Schedule fairness</h1>
        <Select value={selectedLocationId ?? undefined} onValueChange={setSelectedLocationId}>
          <SelectTrigger className="w-56">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>
              Premium shift distribution
              {currentLocation && weekKey && ` — ${weekKeyLabel(weekKey, currentLocation.timezone)}`}
            </CardTitle>
          </div>
          {fairness && (
            <Badge variant={fairness.equityScore >= 70 ? "success" : "warning"}>
              Equity score: {fairness.equityScore.toFixed(0)}/100
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {(fairness?.entries ?? []).map((entry) => (
            <div key={entry.staffId} className="flex items-center justify-between text-sm">
              <span>{entry.name}</span>
              <span className="text-muted-foreground">{entry.premiumHours.toFixed(1)}h premium (Fri/Sat evening)</span>
            </div>
          ))}
          {(fairness?.entries ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No premium shifts this week.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Under / over-scheduled this week</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {underOver.map((entry) => (
            <div key={entry.staffId} className="flex items-center justify-between text-sm">
              <span>{entry.name}</span>
              <span className={entry.delta < 0 ? "text-amber-700" : "text-muted-foreground"}>
                {entry.actualHours.toFixed(1)}h scheduled
                {entry.desiredWeeklyHours != null && ` / ${entry.desiredWeeklyHours}h desired`}
                {entry.delta !== 0 && ` (${entry.delta > 0 ? "+" : ""}${entry.delta.toFixed(1)}h)`}
              </span>
            </div>
          ))}
          {underOver.length === 0 && (
            <p className="text-sm text-muted-foreground">No data for this week yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
