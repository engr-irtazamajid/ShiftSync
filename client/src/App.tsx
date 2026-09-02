import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Role } from "@shiftsync/shared";
import { useAuthStore } from "@/stores/authStore";
import { useAuthBootstrap } from "@/api/auth";
import { connectSocket, disconnectSocket } from "@/sockets/socketClient";
import { useSocketEvents } from "@/sockets/useSocketEvents";
import { LoginPage } from "@/routes/LoginPage";
import { AppShell } from "@/routes/AppShell";
import { RequireRole } from "@/routes/RequireRole";
import { SchedulePage } from "@/routes/SchedulePage";
import { ShiftDetailPage } from "@/routes/ShiftDetailPage";
import { SwapsPage } from "@/routes/SwapsPage";
import { StaffPage } from "@/routes/StaffPage";
import { StaffAvailabilityPage } from "@/routes/StaffAvailabilityPage";
import { OtDashboardPage } from "@/routes/OtDashboardPage";
import { FairnessPage } from "@/routes/FairnessPage";
import { AuditPage } from "@/routes/AuditPage";
import { NotificationsPage } from "@/routes/NotificationsPage";
import { NotificationSettingsPage } from "@/routes/NotificationSettingsPage";

export function App() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);

  useAuthBootstrap();

  useEffect(() => {
    if (accessToken) {
      connectSocket(accessToken);
    } else {
      disconnectSocket();
    }
    return () => disconnectSocket();
  }, [accessToken]);

  useSocketEvents();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireRole />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/schedule" replace />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/schedule/:locationId/:weekKey" element={<SchedulePage />} />
          <Route path="/shifts/:id" element={<ShiftDetailPage />} />
          <Route path="/swaps" element={<SwapsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings/notifications" element={<NotificationSettingsPage />} />

          <Route element={<RequireRole roles={[Role.Admin, Role.Manager]} />}>
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/staff/:id/availability" element={<StaffAvailabilityPage />} />
            <Route path="/ot-dashboard" element={<OtDashboardPage />} />
            <Route path="/analytics/fairness" element={<FairnessPage />} />
          </Route>

          <Route element={<RequireRole roles={[Role.Admin]} />}>
            <Route path="/audit" element={<AuditPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/schedule" replace />} />
    </Routes>
  );
}
