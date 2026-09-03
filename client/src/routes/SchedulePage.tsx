import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Role } from "@shiftsync/shared";
import { useLocations, useSkills } from "@/api/locations";
import { useShifts, usePublishSchedule, useUnpublishSchedule } from "@/api/shifts";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";
import { CreateShiftDialog } from "@/components/schedule/CreateShiftDialog";
import { OnDutyNowPanel } from "@/components/schedule/OnDutyNowPanel";
import { ShiftStatus } from "@shiftsync/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { currentWeekKey, shiftWeekKey, weekKeyLabel } from "@/lib/time";

export function SchedulePage() {
  const params = useParams<{ locationId?: string; weekKey?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { data: locations = [] } = useLocations();
  const { data: skills = [] } = useSkills();
  const { selectedLocationId, setSelectedLocationId, setSelectedWeekKey } = useUiStore();

  const visibleLocations =
    user?.role === Role.Manager
      ? locations.filter((l) => user.managedLocationIds.includes(l.id))
      : locations;

  const rememberedLocationId = visibleLocations.find((l) => l.id === selectedLocationId)?.id;
  const locationId = params.locationId ?? rememberedLocationId ?? visibleLocations[0]?.id;
  const location = visibleLocations.find((l) => l.id === locationId);
  const weekKey = params.weekKey ?? currentWeekKey(location?.timezone ?? "UTC");

  useEffect(() => {
    if (!params.locationId && locationId) {
      navigate(`/schedule/${locationId}/${weekKey}`, { replace: true });
    }
  }, [params.locationId, locationId, weekKey, navigate]);

  useEffect(() => {
    setSelectedLocationId(locationId ?? null);
    setSelectedWeekKey(weekKey);
  }, [locationId, weekKey, setSelectedLocationId, setSelectedWeekKey]);

  const { data: shifts = [] } = useShifts({ locationId, weekKey });
  const publish = usePublishSchedule();
  const unpublish = useUnpublishSchedule();

  const canManage =
    user?.role === Role.Admin ||
    (user?.role === Role.Manager &&
      Boolean(location && user.managedLocationIds.includes(location.id)));

  const draftCount = shifts.filter((s) => s.status === ShiftStatus.Draft).length;
  const publishedCount = shifts.filter((s) => s.status === ShiftStatus.Published).length;
  const hasDrafts = draftCount > 0;
  const hasPublished = publishedCount > 0;

  function goToWeek(delta: number) {
    if (!locationId || !location) return;
    const nextWeek = shiftWeekKey(weekKey, delta, location.timezone);
    navigate(`/schedule/${locationId}/${nextWeek}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select
            value={locationId}
            onValueChange={(value) => navigate(`/schedule/${value}/${weekKey}`)}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {visibleLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => goToWeek(-1)}>
            ←
          </Button>
          <span className="text-sm font-medium">
            {location ? weekKeyLabel(weekKey, location.timezone) : weekKey}
          </span>
          <Button variant="outline" size="sm" onClick={() => goToWeek(1)}>
            →
          </Button>
        </div>

        {canManage && locationId && location && (
          <div className="flex items-center gap-2">
            {shifts.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {hasPublished && <Badge variant="success">{publishedCount} published</Badge>}
                {hasDrafts && <Badge variant="outline">{draftCount} draft</Badge>}
              </div>
            )}
            <CreateShiftDialog location={location} skills={skills} />
            <Button
              variant="outline"
              onClick={() => unpublish.mutate({ locationId, weekKey })}
              disabled={unpublish.isPending || !hasPublished}
              title={!hasPublished ? "No published shifts this week to unpublish" : undefined}
            >
              Unpublish
            </Button>
            <Button
              onClick={() => publish.mutate({ locationId, weekKey })}
              disabled={publish.isPending || !hasDrafts}
              title={!hasDrafts ? "No draft shifts this week to publish" : undefined}
            >
              Publish week{hasDrafts ? ` (${draftCount})` : ""}
            </Button>
          </div>
        )}
      </div>

      <OnDutyNowPanel locationId={locationId} />

      <ScheduleGrid
        shifts={shifts}
        location={location}
        skills={skills}
        canManage={Boolean(canManage)}
        isAdmin={user?.role === Role.Admin}
      />
    </div>
  );
}
