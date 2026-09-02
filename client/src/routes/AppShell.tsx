import { NavLink, Outlet } from "react-router-dom";
import { Role } from "@shiftsync/shared";
import { useAuthStore } from "@/stores/authStore";
import { useLogout } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/schedule", label: "Schedule" },
  { to: "/swaps", label: "Swaps" },
  { to: "/staff", label: "Staff", roles: [Role.Admin, Role.Manager] },
  { to: "/ot-dashboard", label: "Overtime", roles: [Role.Admin, Role.Manager] },
  { to: "/analytics/fairness", label: "Fairness", roles: [Role.Admin, Role.Manager] },
  { to: "/audit", label: "Audit Log", roles: [Role.Admin] },
  { to: "/notifications", label: "Notifications" },
];

export function AppShell() {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold">ShiftSync</span>
            <nav className="flex items-center gap-4">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                      isActive && "text-foreground"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-sm text-muted-foreground">
              {user?.firstName} {user?.lastName}
            </span>
            <Button variant="outline" size="sm" onClick={() => logout.mutate()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="container flex-1 py-6">
        <Outlet />
      </main>
    </div>
  );
}
