import { useState } from "react";
import type { AssignmentDTO, ShiftDTO, UserDTO } from "@shiftsync/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useUsers } from "@/api/users";
import { useAuthStore } from "@/stores/authStore";
import { useCreateSwap } from "@/api/swaps";
import { formatInZone } from "@/lib/time";

interface RequestSwapDialogProps {
  shift: ShiftDTO;
  assignment: AssignmentDTO;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestSwapDialog({
  shift,
  assignment,
  timezone,
  open,
  onOpenChange,
}: RequestSwapDialogProps) {
  const user = useAuthStore((state) => state.user);
  const { data: staff = [] } = useUsers({ role: "staff" });
  const [mode, setMode] = useState<"swap" | "drop">("swap");
  const [targetStaffId, setTargetStaffId] = useState<string>("");
  const createSwap = useCreateSwap();

  const otherStaff = staff.filter((s: UserDTO) => s.id !== user?.id);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTargetStaffId("");
      setMode("swap");
    }
    onOpenChange(next);
  }

  async function handleSubmit() {
    await createSwap.mutateAsync({
      type: mode,
      assignmentId: assignment.id,
      targetStaffId: mode === "swap" ? targetStaffId : undefined,
    });
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request shift change</DialogTitle>
          <DialogDescription>
            {formatInZone(shift.startUtc, timezone, "EEE MMM d, h:mm a")} –{" "}
            {formatInZone(shift.endUtc, timezone, "h:mm a")}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(value) => setMode(value as "swap" | "drop")}>
          <TabsList>
            <TabsTrigger value="swap">Swap with someone</TabsTrigger>
            <TabsTrigger value="drop">Drop (open to anyone)</TabsTrigger>
          </TabsList>

          <TabsContent value="swap" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pick a coworker to offer this shift to. They'll need to accept, then your manager
              approves the swap before it takes effect — your original assignment stays in place
              until then.
            </p>
            <Select value={targetStaffId} onValueChange={setTargetStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Select coworker" />
              </SelectTrigger>
              <SelectContent>
                {otherStaff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.firstName} {member.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>

          <TabsContent value="drop" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This shift will be offered to any qualified staff member who can claim it. If nobody
              claims it within 24 hours of the shift start, the drop request expires automatically.
              Your manager still has to approve the final change — you stay assigned until then.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={(mode === "swap" && !targetStaffId) || createSwap.isPending}
          >
            {createSwap.isPending
              ? "Submitting..."
              : mode === "swap"
                ? "Request swap"
                : "Request drop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
