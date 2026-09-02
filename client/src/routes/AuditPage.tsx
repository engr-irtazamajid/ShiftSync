import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { useLocations } from "@/api/locations";
import { useAuditLog } from "@/api/audit";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { apiClient } from "@/api/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AuditPage() {
  const { data: locations = [] } = useLocations();
  const { selectedLocationId, setSelectedLocationId } = useUiStore();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!selectedLocationId && locations.length > 0) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations, selectedLocationId, setSelectedLocationId]);

  const from = DateTime.now().minus({ days: 30 }).toISODate() ?? "";
  const to = DateTime.now().toISODate() ?? "";

  const { data: entries = [] } = useAuditLog({
    locationId: selectedLocationId ?? undefined,
    from,
    to,
  });

  async function handleExport(format: "csv" | "json") {
    setExporting(true);
    try {
      const response = await apiClient.get("/api/audit/export", {
        params: { locationId: selectedLocationId, from, to, format },
        responseType: "blob",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-log.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" disabled={exporting} onClick={() => handleExport("csv")}>
            Export CSV
          </Button>
          <Button variant="outline" disabled={exporting} onClick={() => handleExport("json")}>
            Export JSON
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Action</th>
                <th className="p-3">Performed by</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="p-3">{new Date(entry.timestamp).toLocaleString()}</td>
                  <td className="p-3">
                    {entry.entityType} ({entry.entityId.slice(-6)})
                  </td>
                  <td className="p-3">{entry.action}</td>
                  <td className="p-3">{entry.performedBy ?? "system"}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No audit entries in this range.
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
