import { useState } from "react";
import type { ShiftDTO, SuggestedAlternative, UserDTO } from "@shiftsync/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ViolationList } from "./ViolationList";
import { useUsers } from "@/api/users";
import {
  useAssignStaff,
  usePreviewAssignment,
  isConstraintViolationError,
  isConflictError,
  getConflictCode,
} from "@/api/shifts";

interface AssignmentDialogProps {
  shift: ShiftDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}

export function AssignmentDialog({ shift, open, onOpenChange, isAdmin }: AssignmentDialogProps) {
  const { data: staff = [] } = useUsers({ role: "staff" });
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState("");
  const preview = usePreviewAssignment();
  const assign = useAssignStaff();
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  async function handleSelect(staffId: string) {
    setSelectedStaffId(staffId);
    setConflictMessage(null);
    await preview.mutateAsync({ shiftId: shift.id, staffId });
  }

  async function handleSelectAlternative(alternative: SuggestedAlternative) {
    await handleSelect(alternative.staffId);
  }

  async function handleConfirm() {
    try {
      await assign.mutateAsync({
        shiftId: shift.id,
        staffId: selectedStaffId,
        expectedShiftVersion: shift.version,
        allowManagerOverride: isAdmin && overrideReason.trim().length > 0,
        overrideReason: overrideReason || undefined,
      });
      onOpenChange(false);
    } catch (error) {
      if (isConflictError(error)) {
        setConflictMessage(
          getConflictCode(error) === "SHIFT_FULL"
            ? "This shift just reached its required headcount. Refresh to see the current roster."
            : "Someone else just modified this shift. Refresh to see the latest version before assigning."
        );
      } else if (!isConstraintViolationError(error)) {
        setConflictMessage("Something went wrong while assigning this staff member.");
      }
    }
  }

  const requiresOverride = preview.data?.violations.some(
    (v) => v.rule === "SEVENTH_CONSECUTIVE_DAY"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign staff to shift</DialogTitle>
          <DialogDescription>
            Select a staff member to preview scheduling constraints before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={selectedStaffId} onValueChange={handleSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select staff member" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((member: UserDTO) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {preview.isPending && <p className="text-sm text-muted-foreground">Checking constraints...</p>}

          {preview.data && (
            <>
              <ViolationList result={preview.data} onSelectAlternative={handleSelectAlternative} />
              <p className="text-sm text-muted-foreground">
                Projected weekly hours: {preview.data.projectedWeeklyHours.toFixed(1)}h
                {preview.data.pushesIntoOvertime && (
                  <span className="ml-1 font-medium text-amber-700">
                    (pushes into overtime, +${preview.data.projectedWeeklyOvertimeCost.toFixed(2)})
                  </span>
                )}
              </p>
            </>
          )}

          {requiresOverride && isAdmin && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Override reason (required)</label>
              <textarea
                className="w-full rounded-md border border-input p-2 text-sm"
                rows={2}
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="Document why this 7th consecutive day is approved"
              />
            </div>
          )}

          {conflictMessage && <p className="text-sm text-destructive">{conflictMessage}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              !selectedStaffId ||
              !preview.data ||
              (preview.data.violations.some((v) => v.severity === "block") &&
                !(requiresOverride && isAdmin && overrideReason.trim().length > 0)) ||
              assign.isPending
            }
          >
            {assign.isPending ? "Assigning..." : "Confirm assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
