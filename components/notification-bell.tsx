"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useVisibilityAwarePolling } from "@/components/use-visibility-aware-polling";
import { readApiJson } from "@/lib/http/read-api-json";

type NotificationsResponse = {
  unreadCount: number;
};

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch("/api/footprints/inbox", { signal });
      if (!response?.ok) return;
      const result = await readApiJson<NotificationsResponse>(
        response,
        "通知同步失败。",
      );
      if (!signal.aborted) setUnreadCount(result.unreadCount);
    } catch {
      // The next visible, online polling cycle retries failed inbox reads.
    }
  }, []);

  useVisibilityAwarePolling({
    enabled: true,
    intervalMs: 60_000,
    task: load,
  });

  return (
    <Link href="/footprints#inbox" className="notification-bell button-secondary size-10 !p-0" aria-label="待你看看" title="待你看看">
      <Bell size={18} />
      {unreadCount > 0 && (
        <span>{unreadCount > 9 ? "9+" : unreadCount}</span>
      )}
    </Link>
  );
}
