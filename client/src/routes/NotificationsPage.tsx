import { useNavigate } from "react-router-dom";
import type { NotificationDTO } from "@shiftsync/shared";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/api/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { resolveNotificationLink } from "@/lib/notificationLink";

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  function handleOpen(notification: NotificationDTO) {
    if (!notification.readAt) markRead.mutate(notification.id);
    const link = resolveNotificationLink(notification);
    if (link) navigate(link);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
            Mark all as read
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!isLoading && notifications.length === 0 && (
        <p className="text-sm text-muted-foreground">You're all caught up.</p>
      )}

      <div className="space-y-2">
        {notifications.map((notification) => {
          const isNavigable = resolveNotificationLink(notification) !== null;
          return (
            <Card
              key={notification.id}
              onClick={() => isNavigable && handleOpen(notification)}
              className={cn(
                !notification.readAt && "border-primary/50 bg-primary/5",
                isNavigable && "cursor-pointer transition-colors hover:border-primary/50"
              )}
            >
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-sm text-muted-foreground">{notification.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
                {!notification.readAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      markRead.mutate(notification.id);
                    }}
                  >
                    Mark read
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
