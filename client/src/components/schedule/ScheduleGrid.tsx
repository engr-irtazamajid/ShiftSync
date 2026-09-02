import { useMemo, useState } from "react";
import type { LocationDTO, ShiftDTO, SkillDTO } from "@shiftsync/shared";
import { AssignmentStatus } from "@shiftsync/shared";
import { ShiftCard } from "./ShiftCard";
import { AssignmentDialog } from "@/components/assignment/AssignmentDialog";
import { RequestSwapDialog } from "@/components/swaps/RequestSwapDialog";
import { useAssignmentsForShifts } from "@/api/assignments";
import { useAuthStore } from "@/stores/authStore";
import { toLocalDateString } from "@/lib/localDate";

interface ScheduleGridProps {
  shifts: ShiftDTO[];
  location: LocationDTO | undefined;
  skills: SkillDTO[];
  canManage: boolean;
  isAdmin: boolean;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ScheduleGrid({ shifts, location, skills, canManage, isAdmin }: ScheduleGridProps) {
  const user = useAuthStore((state) => state.user);
  const [activeShift, setActiveShift] = useState<ShiftDTO | null>(null);
  const [swapShift, setSwapShift] = useState<ShiftDTO | null>(null);
  const shiftIds = useMemo(() => shifts.map((s) => s.id), [shifts]);
  const { data: assignments = [] } = useAssignmentsForShifts(shiftIds);
  const skillById = new Map(skills.map((s) => [s.id, s]));

  const countByShift = useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      if (assignment.status !== AssignmentStatus.Active) continue;
      counts.set(assignment.shiftId, (counts.get(assignment.shiftId) ?? 0) + 1);
    }
    return counts;
  }, [assignments]);

  const myAssignmentByShift = useMemo(() => {
    const map = new Map<string, (typeof assignments)[number]>();
    for (const assignment of assignments) {
      if (assignment.status === AssignmentStatus.Active && assignment.staffId === user?.id) {
        map.set(assignment.shiftId, assignment);
      }
    }
    return map;
  }, [assignments, user?.id]);

  const timezone = location?.timezone ?? "UTC";
  const shiftsByDay = useMemo(() => {
    const buckets: ShiftDTO[][] = Array.from({ length: 7 }, () => []);
    for (const shift of shifts) {
      const dayIndex = new Date(toLocalDateString(shift.startUtc, timezone) + "T00:00:00Z").getUTCDay();
      buckets[dayIndex].push(shift);
    }
    return buckets;
  }, [shifts, timezone]);

  function handleShiftClick(shift: ShiftDTO) {
    if (canManage) {
      setActiveShift(shift);
      return;
    }
    if (myAssignmentByShift.has(shift.id)) {
      setSwapShift(shift);
    }
  }

  const swapAssignment = swapShift ? myAssignmentByShift.get(swapShift.id) : undefined;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
        {DAY_LABELS.map((label, index) => (
          <div key={label} className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">{label}</p>
            <div className="space-y-2">
              {shiftsByDay[index].map((shift) => (
                <ShiftCard
                  key={shift.id}
                  shift={shift}
                  location={location}
                  skill={skillById.get(shift.requiredSkillId)}
                  assignedCount={countByShift.get(shift.id) ?? 0}
                  isMine={myAssignmentByShift.has(shift.id)}
                  isClickable={canManage || myAssignmentByShift.has(shift.id)}
                  onClick={() => handleShiftClick(shift)}
                />
              ))}
              {shiftsByDay[index].length === 0 && (
                <p className="text-xs text-muted-foreground">No shifts</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeShift && (
        <AssignmentDialog
          shift={activeShift}
          open={Boolean(activeShift)}
          onOpenChange={(open) => !open && setActiveShift(null)}
          isAdmin={isAdmin}
        />
      )}

      {swapShift && swapAssignment && (
        <RequestSwapDialog
          shift={swapShift}
          assignment={swapAssignment}
          timezone={timezone}
          open={Boolean(swapShift)}
          onOpenChange={(open) => !open && setSwapShift(null)}
        />
      )}
    </>
  );
}
