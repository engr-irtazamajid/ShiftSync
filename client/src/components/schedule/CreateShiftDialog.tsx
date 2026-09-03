import { useState } from "react";
import type { LocationDTO, SkillDTO } from "@shiftsync/shared";
import { DateTime } from "luxon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateShift } from "@/api/shifts";

interface CreateShiftDialogProps {
  location: LocationDTO;
  skills: SkillDTO[];
}

export function CreateShiftDialog({ location, skills }: CreateShiftDialogProps) {
  const [open, setOpen] = useState(false);
  const [skillId, setSkillId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [headcount, setHeadcount] = useState(1);
  const createShift = useCreateShift();

  function toUtcIso(dateStr: string, timeStr: string, dayOffset = 0): string {
    const [hour, minute] = timeStr.split(":").map(Number);
    const dt = DateTime.fromISO(dateStr, { zone: location.timezone })
      .plus({ days: dayOffset })
      .set({ hour, minute, second: 0, millisecond: 0 });
    return dt.toUTC().toISO() ?? "";
  }

  async function handleSubmit() {
    const [startHour] = startTime.split(":").map(Number);
    const [endHour] = endTime.split(":").map(Number);
    const overnight = endHour <= startHour;

    await createShift.mutateAsync({
      locationId: location.id,
      requiredSkillId: skillId,
      startUtc: toUtcIso(date, startTime),
      endUtc: toUtcIso(date, endTime, overnight ? 1 : 0),
      headcount,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">New shift</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create shift</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Required skill</Label>
            <Select value={skillId} onValueChange={setSkillId}>
              <SelectTrigger>
                <SelectValue placeholder="Select skill" />
              </SelectTrigger>
              <SelectContent>
                {skills.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Date ({location.timezone})</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            If end time is earlier than start time, the shift is treated as overnight (ends the next
            day).
          </p>

          <div className="space-y-1">
            <Label>Headcount needed</Label>
            <Input
              type="number"
              min={1}
              value={headcount}
              onChange={(e) => setHeadcount(Number(e.target.value))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!skillId || !date || createShift.isPending}>
            {createShift.isPending ? "Creating..." : "Create shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
