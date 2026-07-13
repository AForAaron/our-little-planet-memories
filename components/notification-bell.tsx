"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type NotificationsResponse = {
  unreadCount: number;
};

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/footprints/inbox").catch(() => null);
      if (!response?.ok) return;
      const result = (await response.json()) as NotificationsResponse;
      if (!cancelled) setUnreadCount(result.unreadCount);
    }
    void load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <Link href="/footprints#inbox" className="notification-bell button-secondary size-10 !p-0" aria-label="待你看看" title="待你看看">
      <Bell size={18} />
      {unreadCount > 0 && (
        <span>{unreadCount > 9 ? "9+" : unreadCount}</span>
      )}
    </Link>
  );
}
