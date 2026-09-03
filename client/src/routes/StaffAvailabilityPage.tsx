import { useParams } from "react-router-dom";
import { useState } from "react";
import { AvailabilityType } from "@shiftsync/shared";
import {
  useUser,
  useUserAvailability,
  useReplaceAvailability,
  useAddAvailabilityException,
} from "@/api/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface RecurringDraft {
  dayOfWeek: number;
  startLocalTime: string;
  endLocalTime: string;
}

export function StaffAvailabilityPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useUser(id);
  const { data: availability = [] } = useUserAvailability(id);
  const replaceAvailability = useReplaceAvailability(id);
  const addException = useAddAvailabilityException(id);

  const recurring = availability.filter((a) => a.type === AvailabilityType.Recurring);
  const exceptions = availability.filter((a) => a.type === AvailabilityType.Exception);

  const [draft, setDraft] = useState<RecurringDraft>({
    dayOfWeek: 1,
    startLocalTime: "09:00",
    endLocalTime: "17:00",
  });
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionUnavailable, setExceptionUnavailable] = useState(true);

  function addRecurringDraft() {
    const next = [
      ...recurring.map((r) => ({
        dayOfWeek: r.dayOfWeek!,
        startLocalTime: r.startLocalTime!,
        endLocalTime: r.endLocalTime!,
      })),
      draft,
    ];
    replaceAvailability.mutate(next);
  }

  function removeRecurring(index: number) {
    const next = recurring
      .filter((_, i) => i !== index)
      .map((r) => ({
        dayOfWeek: r.dayOfWeek!,
        startLocalTime: r.startLocalTime!,
        endLocalTime: r.endLocalTime!,
      }));
    replaceAvailability.mutate(next);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">
        {user ? `${user.firstName} ${user.lastName}'s availability` : "Availability"}
      </h1>
      <p className="text-sm text-muted-foreground">
        Recurring windows are wall-clock times interpreted against each shift's own location
        timezone.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Recurring weekly availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recurring.map((entry, index) => (
            <div key={entry.id} className="flex items-center justify-between text-sm">
              <span>
                {DAYS[entry.dayOfWeek!]}: {entry.startLocalTime} – {entry.endLocalTime}
              </span>
              <Button variant="ghost" size="sm" onClick={() => removeRecurring(index)}>
                Remove
              </Button>
            </div>
          ))}

          <div className="flex items-end gap-2 border-t pt-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Day</label>
              <Select
                value={String(draft.dayOfWeek)}
                onValueChange={(value) => setDraft({ ...draft, dayOfWeek: Number(value) })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day, index) => (
                    <SelectItem key={day} value={String(index)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start</label>
              <Input
                type="time"
                value={draft.startLocalTime}
                onChange={(e) => setDraft({ ...draft, startLocalTime: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">End</label>
              <Input
                type="time"
                value={draft.endLocalTime}
                onChange={(e) => setDraft({ ...draft, endLocalTime: e.target.value })}
              />
            </div>
            <Button onClick={addRecurringDraft}>Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>One-off exceptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {exceptions.map((entry) => (
            <div key={entry.id} className="text-sm">
              {entry.exceptionDate}:{" "}
              {entry.isUnavailable
                ? "Unavailable all day"
                : `${entry.exceptionStartLocalTime} – ${entry.exceptionEndLocalTime}`}
            </div>
          ))}

          <div className="flex items-end gap-2 border-t pt-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input
                type="date"
                value={exceptionDate}
                onChange={(e) => setExceptionDate(e.target.value)}
              />
            </div>
            <Select
              value={exceptionUnavailable ? "unavailable" : "available"}
              onValueChange={(value) => setExceptionUnavailable(value === "unavailable")}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unavailable">Mark unavailable</SelectItem>
                <SelectItem value="available">Mark available</SelectItem>
              </SelectContent>
            </Select>
            <Button
              disabled={!exceptionDate}
              onClick={() =>
                addException.mutate({
                  exceptionDate,
                  isUnavailable: exceptionUnavailable,
                })
              }
            >
              Add exception
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
