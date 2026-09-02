import { Navigate, Outlet } from "react-router-dom";
import type { Role } from "@shiftsync/shared";
import { useAuthStore } from "@/stores/authStore";

export function RequireRole({ roles }: { roles?: Role[] }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/schedule" replace />;
  }

  return <Outlet />;
}
