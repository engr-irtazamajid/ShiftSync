import { useState } from "react";
import { Bell } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate } from "react-router-dom";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/api/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { resolveNotificationLink } from "@/lib/notificationLink";
import type { NotificationDTO } from "@shiftsync/shared";

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  function handleClick(notification: NotificationDTO) {
    if (!notification.readAt) markRead.mutate(notification.id);
    const link = resolveNotificationLink(notification);
    setOpen(false);
    if (link) navigate(link);
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 w-80 max-h-96 overflow-y-auto rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
        >
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => markAllRead.mutate()}
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          )}
          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={cn(
                "block w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent",
                !notification.readAt && "bg-accent/50 font-medium"
              )}
            >
              <div>{notification.title}</div>
              <div className="text-xs text-muted-foreground">{notification.body}</div>
            </button>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
