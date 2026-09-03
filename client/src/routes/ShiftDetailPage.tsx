import { useParams } from "react-router-dom";
import { useShift, useShiftHistory } from "@/api/shifts";
import { useShiftAssignments } from "@/api/assignments";
import { useLocations, useSkills } from "@/api/locations";
import { useUsers } from "@/api/users";
import { AssignmentStatus } from "@shiftsync/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInZone } from "@/lib/time";

export function ShiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: shift } = useShift(id);
  const { data: assignments = [] } = useShiftAssignments(id);
  const { data: history = [] } = useShiftHistory(id);
  const { data: locations = [] } = useLocations();
  const { data: skills = [] } = useSkills();
  const { data: staff = [] } = useUsers();

  if (!shift) return <p className="text-sm text-muted-foreground">Loading shift...</p>;

  const location = locations.find((l) => l.id === shift.locationId);
  const skill = skills.find((s) => s.id === shift.requiredSkillId);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const timezone = location?.timezone ?? "UTC";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {skill?.name ?? "Shift"} at {location?.name ?? "—"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatInZone(shift.startUtc, timezone)} –{" "}
          {formatInZone(shift.endUtc, timezone, "h:mm a")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {assignments
            .filter((a) => a.status === AssignmentStatus.Active)
            .map((assignment) => {
              const member = staffById.get(assignment.staffId);
              return (
                <p key={assignment.id} className="text-sm">
                  {member ? `${member.firstName} ${member.lastName}` : assignment.staffId}
                </p>
              );
            })}
          {assignments.filter((a) => a.status === AssignmentStatus.Active).length === 0 && (
            <p className="text-sm text-muted-foreground">No one assigned yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.map((entry) => (
            <div key={entry.id} className="text-sm text-muted-foreground">
              {new Date(entry.timestamp).toLocaleString()} — {entry.action}
            </div>
          ))}
          {history.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
