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

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Skills</th>
                <th className="p-3 font-medium">Desired hours</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-0">
                    <Link
                      to={`/staff/${member.id}/availability`}
                      className="block p-3 font-medium"
                    >
                      {member.firstName} {member.lastName}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{member.email}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {member.skillIds.map((id) => (
                        <Badge key={id} variant="secondary" className="font-normal">
                          {skillById.get(id) ?? id}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {member.desiredWeeklyHours != null ? `${member.desiredWeeklyHours}h/week` : "—"}
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No staff members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
