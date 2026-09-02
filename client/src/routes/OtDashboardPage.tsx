import { useEffect, useState } from "react";
import { useLocations } from "@/api/locations";
import { useOtDashboard } from "@/api/analytics";
import { useUiStore } from "@/stores/uiStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { currentWeekKey } from "@/lib/time";

export function OtDashboardPage() {
  const { data: locations = [] } = useLocations();
  const { selectedLocationId, setSelectedLocationId, selectedWeekKey, setSelectedWeekKey } = useUiStore();
  const [weekKey, setWeekKey] = useState(selectedWeekKey ?? "");

  useEffect(() => {
    if (!selectedLocationId && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId, setSelectedLocationId]);

  useEffect(() => {
    if (!weekKey && selectedLocationId) {
      const location = locations.find((l) => l.id === selectedLocationId);
      const key = currentWeekKey(location?.timezone ?? "UTC");
      setWeekKey(key);
      setSelectedWeekKey(key);
    }
  }, [selectedLocationId, locations, weekKey, setSelectedWeekKey]);

  const { data: rows = [] } = useOtDashboard({ locationId: selectedLocationId ?? undefined, weekKey });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Overtime dashboard</h1>
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
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="p-3">Staff</th>
                <th className="p-3">Projected hours</th>
                <th className="p-3">Overtime hours</th>
                <th className="p-3">Projected OT cost</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.staffId} className="border-b last:border-0">
                  <td className="p-3">{row.name}</td>
                  <td className="p-3">{row.projectedWeeklyHours.toFixed(1)}h</td>
                  <td className="p-3">{row.projectedOvertimeHours.toFixed(1)}h</td>
                  <td className="p-3">${row.projectedOvertimeCost.toFixed(2)}</td>
                  <td className="p-3">
                    <Badge
                      variant={
                        row.status === "block" ? "destructive" : row.status === "warn" ? "warning" : "success"
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No projected hours for this week.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
