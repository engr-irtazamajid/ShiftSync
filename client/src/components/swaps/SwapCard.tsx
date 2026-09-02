import type { SwapRequestDTO } from "@shiftsync/shared";
import { SwapStatus, SwapType } from "@shiftsync/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatInZone } from "@/lib/time";

const STATUS_LABEL: Record<SwapStatus, string> = {
  [SwapStatus.PendingTargetAcceptance]: "Awaiting target",
  [SwapStatus.PendingClaim]: "Open to claim",
  [SwapStatus.PendingManagerApproval]: "Awaiting manager",
  [SwapStatus.Approved]: "Approved",
  [SwapStatus.Denied]: "Denied",
  [SwapStatus.AutoCancelled]: "Auto-cancelled",
  [SwapStatus.Expired]: "Expired",
  [SwapStatus.Withdrawn]: "Withdrawn",
};

export interface SwapCardDetails {
  requesterName: string;
  targetName: string | null;
  claimantName: string | null;
  skillName: string | null;
  locationName: string | null;
  shiftStartUtc: string | null;
  shiftEndUtc: string | null;
  timezone: string | null;
}

interface SwapCardProps {
  swap: SwapRequestDTO;
  details?: SwapCardDetails;
  actions?: Array<{ label: string; variant?: "default" | "outline" | "destructive"; onClick: () => void }>;
}

function describeParties(swap: SwapRequestDTO, details?: SwapCardDetails): string {
  if (!details) return "";

  if (swap.type === SwapType.Swap) {
    if (details.targetName) {
      return `${details.requesterName} → ${details.targetName}`;
    }
    return `${details.requesterName} is requesting a swap`;
  }

  // drop
  if (details.claimantName) {
    return `${details.requesterName} dropped, claimed by ${details.claimantName}`;
  }
  return `${details.requesterName} dropped this shift`;
}

function describeShift(details?: SwapCardDetails): string | null {
  if (!details || !details.shiftStartUtc || !details.shiftEndUtc || !details.timezone) return null;
  const skill = details.skillName ? `${details.skillName} @ ` : "";
  const location = details.locationName ?? "";
  const time = `${formatInZone(details.shiftStartUtc, details.timezone, "EEE MMM d, h:mm a")} – ${formatInZone(
    details.shiftEndUtc,
    details.timezone,
    "h:mm a"
  )}`;
  return `${skill}${location} · ${time}`;
}

export function SwapCard({ swap, details, actions = [] }: SwapCardProps) {
  const parties = describeParties(swap, details);
  const shiftSummary = describeShift(details);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {swap.type === SwapType.Swap ? "Shift swap" : "Drop request"}
            </span>
            <Badge variant="outline">{STATUS_LABEL[swap.status]}</Badge>
          </div>
          {parties && <p className="mt-0.5 text-sm">{parties}</p>}
          {shiftSummary && <p className="text-xs text-muted-foreground">{shiftSummary}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            Requested {new Date(swap.createdAt).toLocaleString()}
          </p>
          {swap.managerDecisionReason && (
            <p className="mt-1 text-xs text-muted-foreground">Reason: {swap.managerDecisionReason}</p>
          )}
          {swap.autoCancelledReason && (
            <p className="mt-1 text-xs text-destructive">Cancelled: {swap.autoCancelledReason}</p>
          )}
        </div>
        {actions.length > 0 && (
          <div className="flex shrink-0 gap-2">
            {actions.map((action) => (
              <Button key={action.label} size="sm" variant={action.variant ?? "default"} onClick={action.onClick}>
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
