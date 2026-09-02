import { Link } from "react-router-dom";
import { Role } from "@shiftsync/shared";
import { useUsers } from "@/api/users";
import { useSkills } from "@/api/locations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function StaffPage() {
  const { data: staff = [] } = useUsers({ role: Role.Staff });
  const { data: skills = [] } = useSkills();

  const skillById = new Map(skills.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Staff roster</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {staff.map((member) => (
          <Link key={member.id} to={`/staff/${member.id}/availability`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent className="space-y-2 p-4">
                <p className="font-medium">
                  {member.firstName} {member.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
                <div className="flex flex-wrap gap-1">
                  {member.skillIds.map((id) => (
                    <Badge key={id} variant="secondary">
                      {skillById.get(id) ?? id}
                    </Badge>
                  ))}
                </div>
                {member.desiredWeeklyHours != null && (
                  <p className="text-xs text-muted-foreground">
                    Desired: {member.desiredWeeklyHours}h/week
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {staff.length === 0 && <p className="text-sm text-muted-foreground">No staff members yet.</p>}
    </div>
  );
}
