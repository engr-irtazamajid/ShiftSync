import type { LocationDTO, ShiftDTO, SkillDTO } from "@shiftsync/shared";
import { ShiftStatus } from "@shiftsync/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatInZone } from "@/lib/time";
import { cn } from "@/lib/utils";

interface ShiftCardProps {
  shift: ShiftDTO;
  location: LocationDTO | undefined;
  skill: SkillDTO | undefined;
  assignedCount: number;
  isMine?: boolean;
  isClickable?: boolean;
  onClick: () => void;
}

export function ShiftCard({
  shift,
  location,
  skill,
  assignedCount,
  isMine,
  isClickable,
  onClick,
}: ShiftCardProps) {
  const timezone = location?.timezone ?? "UTC";
  const isFull = assignedCount >= shift.headcount;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "transition-colors",
        isClickable
          ? cn("cursor-pointer hover:border-primary/50", isMine && "border-primary/40")
          : isMine && "border-primary/40",
        shift.status === ShiftStatus.Draft && "border-dashed opacity-80",
        shift.status === ShiftStatus.Cancelled && "opacity-50"
      )}
    >
      <CardContent className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium">{skill?.name ?? "Any skill"}</span>
          <div className="flex gap-1">
            {isMine && <Badge>Mine</Badge>}
            {shift.isPremium && <Badge variant="secondary">Premium</Badge>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatInZone(shift.startUtc, timezone, "h:mm a")} –{" "}
          {formatInZone(shift.endUtc, timezone, "h:mm a")}
        </p>
        <div className="flex items-center justify-between text-xs">
          <span className={cn(isFull ? "text-emerald-700" : "text-amber-700")}>
            {assignedCount}/{shift.headcount} staffed
          </span>
          {shift.status === ShiftStatus.Draft && <Badge variant="outline">Draft</Badge>}
          {shift.status === ShiftStatus.Cancelled && <Badge variant="destructive">Cancelled</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
