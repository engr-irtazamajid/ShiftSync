import { useOnDutyNow } from "@/api/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function OnDutyNowPanel({ locationId }: { locationId: string | undefined }) {
  const { data: onDuty = [] } = useOnDutyNow(locationId);

  if (!locationId) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">On duty now</CardTitle>
        <Badge variant="success">{onDuty.length} active</Badge>
      </CardHeader>
      <CardContent className="space-y-1">
        {onDuty.length === 0 && (
          <p className="text-sm text-muted-foreground">No one currently on shift.</p>
        )}
        {onDuty.map((entry) => (
          <p key={`${entry.staffId}-${entry.shiftId}`} className="text-sm">
            {entry.name}{" "}
            <span className="text-xs text-muted-foreground">
              since {new Date(entry.startUtc).toLocaleTimeString()}, until{" "}
              {new Date(entry.endUtc).toLocaleTimeString()}
            </span>
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
