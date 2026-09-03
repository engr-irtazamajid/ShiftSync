import { useMemo, useState } from "react";
import { Role, SwapStatus, SwapType, OPEN_SWAP_STATUSES } from "@shiftsync/shared";
import type { SwapRequestDTO } from "@shiftsync/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwapCard, type SwapCardDetails } from "@/components/swaps/SwapCard";
import { DenyReasonDialog } from "@/components/swaps/DenyReasonDialog";
import { useAuthStore } from "@/stores/authStore";
import { useUsers } from "@/api/users";
import { useAssignmentsByIds } from "@/api/assignments";
import { useShiftsByIds } from "@/api/shifts";
import { useLocations, useSkills } from "@/api/locations";
import {
  useSwaps,
  useAcceptSwap,
  useRejectSwap,
  useClaimDrop,
  useWithdrawSwap,
  useApproveSwap,
  useDenySwap,
} from "@/api/swaps";

export function SwapsPage() {
  const user = useAuthStore((state) => state.user);
  const isManager = user?.role === Role.Manager || user?.role === Role.Admin;
  const [tab, setTab] = useState(isManager ? "approvals" : "outgoing");
  const [denyTargetId, setDenyTargetId] = useState<string | null>(null);

  const mine = useSwaps({ requestedBy: user?.id });
  const incomingSwaps = useSwaps({
    targetStaffId: user?.id,
    status: SwapStatus.PendingTargetAcceptance,
  });
  const drops = useSwaps({ type: SwapType.Drop, status: SwapStatus.PendingClaim });
  const approvals = useSwaps({ status: SwapStatus.PendingManagerApproval });

  const accept = useAcceptSwap();
  const reject = useRejectSwap();
  const claim = useClaimDrop();
  const withdraw = useWithdrawSwap();
  const approve = useApproveSwap();
  const deny = useDenySwap();

  const incoming = useMemo(() => incomingSwaps.data ?? [], [incomingSwaps.data]);

  const allVisibleSwaps = useMemo<SwapRequestDTO[]>(
    () => [...(mine.data ?? []), ...incoming, ...(drops.data ?? []), ...(approvals.data ?? [])],
    [mine.data, incoming, drops.data, approvals.data]
  );

  const assignmentIds = useMemo(
    () => Array.from(new Set(allVisibleSwaps.map((s) => s.assignmentId))),
    [allVisibleSwaps]
  );
  const { data: assignments = [] } = useAssignmentsByIds(assignmentIds);

  const shiftIds = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.shiftId))),
    [assignments]
  );
  const { data: shifts = [] } = useShiftsByIds(shiftIds);

  const { data: staff = [] } = useUsers();
  const { data: locations = [] } = useLocations();
  const { data: skills = [] } = useSkills();

  const detailsBySwapId = useMemo(() => {
    const assignmentById = new Map(assignments.map((a) => [a.id, a]));
    const shiftById = new Map(shifts.map((s) => [s.id, s]));
    const staffById = new Map(staff.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
    const locationById = new Map(locations.map((l) => [l.id, l]));
    const skillById = new Map(skills.map((s) => [s.id, s.name]));

    const map = new Map<string, SwapCardDetails>();
    for (const swap of allVisibleSwaps) {
      const assignment = assignmentById.get(swap.assignmentId);
      const shift = assignment ? shiftById.get(assignment.shiftId) : undefined;
      const location = shift ? locationById.get(shift.locationId) : undefined;

      map.set(swap.id, {
        requesterName: staffById.get(swap.requestedBy) ?? "Unknown staff",
        targetName: swap.targetStaffId
          ? (staffById.get(swap.targetStaffId) ?? "Unknown staff")
          : null,
        claimantName: swap.claimedBy ? (staffById.get(swap.claimedBy) ?? "Unknown staff") : null,
        skillName: shift ? (skillById.get(shift.requiredSkillId) ?? null) : null,
        locationName: location?.name ?? null,
        shiftStartUtc: shift?.startUtc ?? null,
        shiftEndUtc: shift?.endUtc ?? null,
        timezone: location?.timezone ?? null,
      });
    }
    return map;
  }, [allVisibleSwaps, assignments, shifts, staff, locations, skills]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Swaps &amp; drops</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {!isManager && <TabsTrigger value="outgoing">My requests</TabsTrigger>}
          {!isManager && <TabsTrigger value="incoming">Incoming</TabsTrigger>}
          <TabsTrigger value="drops">Available drops</TabsTrigger>
          {isManager && <TabsTrigger value="approvals">Needs approval</TabsTrigger>}
        </TabsList>

        {!isManager && (
          <TabsContent value="outgoing" className="space-y-2">
            {(mine.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            )}
            {(mine.data ?? []).map((swap) => (
              <SwapCard
                key={swap.id}
                swap={swap}
                details={detailsBySwapId.get(swap.id)}
                actions={
                  swap.status !== SwapStatus.PendingManagerApproval &&
                  OPEN_SWAP_STATUSES.includes(swap.status)
                    ? [
                        {
                          label: "Withdraw",
                          variant: "outline",
                          onClick: () => withdraw.mutate({ id: swap.id }),
                        },
                      ]
                    : []
                }
              />
            ))}
          </TabsContent>
        )}

        {!isManager && (
          <TabsContent value="incoming" className="space-y-2">
            {incoming.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing pending.</p>
            )}
            {incoming.map((swap) => (
              <SwapCard
                key={swap.id}
                swap={swap}
                details={detailsBySwapId.get(swap.id)}
                actions={[
                  { label: "Accept", onClick: () => accept.mutate({ id: swap.id }) },
                  {
                    label: "Reject",
                    variant: "outline",
                    onClick: () => reject.mutate({ id: swap.id }),
                  },
                ]}
              />
            ))}
          </TabsContent>
        )}

        <TabsContent value="drops" className="space-y-2">
          {(drops.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No open drop requests right now.</p>
          )}
          {(drops.data ?? []).map((swap) => (
            <SwapCard
              key={swap.id}
              swap={swap}
              details={detailsBySwapId.get(swap.id)}
              actions={
                !isManager ? [{ label: "Claim", onClick: () => claim.mutate({ id: swap.id }) }] : []
              }
            />
          ))}
        </TabsContent>

        {isManager && (
          <TabsContent value="approvals" className="space-y-2">
            {(approvals.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing awaiting approval.</p>
            )}
            {(approvals.data ?? []).map((swap) => (
              <SwapCard
                key={swap.id}
                swap={swap}
                details={detailsBySwapId.get(swap.id)}
                actions={[
                  { label: "Approve", onClick: () => approve.mutate({ id: swap.id }) },
                  {
                    label: "Deny",
                    variant: "destructive",
                    onClick: () => setDenyTargetId(swap.id),
                  },
                ]}
              />
            ))}
          </TabsContent>
        )}
      </Tabs>

      <DenyReasonDialog
        open={denyTargetId !== null}
        onOpenChange={(open) => !open && setDenyTargetId(null)}
        isPending={deny.isPending}
        onConfirm={(reason) => {
          if (!denyTargetId) return;
          deny.mutate(
            { id: denyTargetId, body: { reason } },
            { onSuccess: () => setDenyTargetId(null) }
          );
        }}
      />
    </div>
  );
}
