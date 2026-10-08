import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { getNotifications, markAllRead, markRead } from "@/api/notifications";
import { formatDateTime } from "@/utils";
import TopBar from "@/components/layout/TopBar";
import EmptyState from "@/components/common/EmptyState";
import { Skeleton } from "@/components/common/Loader";
import Button from "@/components/common/Button";

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["notifications"], queryFn: getNotifications });
  const notifications = data?.notifications || [];
  const unread = notifications.filter((n) => !n.is_read).length;

  // The bell badge in the top bar reads a separate query, so refresh it too.
  const refreshNotifications = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["notifications"] }),
    qc.invalidateQueries({ queryKey: ["notifications-unread-count"] }),
  ]);

  const markAllMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: refreshNotifications,
  });

  const markOneMutation = useMutation({
    mutationFn: markRead,
    onSuccess: refreshNotifications,
  });

  return (
    <div className="min-h-screen">
      <TopBar title="Notifications" right={
        unread > 0 && (
          <Button variant="ghost" size="sm" className="pop:underline pop:decoration-2 pop:underline-offset-4" onClick={() => markAllMutation.mutate()} loading={markAllMutation.isPending}>
            Mark all read
          </Button>
        )
      } />
      <div className="px-4 py-3 space-y-2 pop:space-y-4 pop:py-5">
        {isLoading
          ? Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl pop:rounded-[22px]" />)
          : notifications.length === 0
            ? <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
            : notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markOneMutation.mutate(n.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all pop:rounded-[22px] pop:border-[2.5px] pop:border-ink ${n.is_read ? "bg-surface border-surface-border opacity-60 pop:bg-white pop:opacity-70" : "bg-surface border-teal/20 bg-teal/5 pop:bg-sun pop:shadow-pop-sm pop:active:translate-x-[2px] pop:active:translate-y-[2px] pop:active:shadow-pop-xs"}`}
                >
                  <div className="flex items-start gap-3">
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-teal flex-shrink-0 mt-1.5 pop:w-3 pop:h-3 pop:bg-ink pop:mt-1" />}
                    <div className="flex-1">
                      <p className={`text-sm font-semibold pop:font-extrabold ${n.is_read ? "text-slate-muted" : "text-ink"}`}>{n.title}</p>
                      <p className="text-slate-muted text-xs mt-0.5 leading-relaxed pop:font-medium pop:text-ink/80">{n.body}</p>
                      <p className="text-slate-muted text-[10px] mt-1 pop:font-bold">{formatDateTime(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
      </div>
    </div>
  );
}
