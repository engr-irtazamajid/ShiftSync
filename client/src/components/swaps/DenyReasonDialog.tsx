import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface DenyReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
}

export function DenyReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: DenyReasonDialogProps) {
  const [reason, setReason] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setReason("");
    onOpenChange(next);
  }

  function handleConfirm() {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deny request</DialogTitle>
          <DialogDescription>
            Provide a reason for denying this swap or drop request. The requester will see this.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="deny-reason">Reason</Label>
          <textarea
            id="deny-reason"
            className="w-full rounded-md border border-input p-2 text-sm"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. No qualified coverage available for this shift"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || isPending}
          >
            {isPending ? "Denying..." : "Deny request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
