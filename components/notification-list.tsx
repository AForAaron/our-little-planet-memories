"use client";

import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { ActivityNotification } from "@/lib/database.types";
import { readApiJson } from "@/lib/http/read-api-json";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function NotificationList({
  initialItems,
}: {
  initialItems: ActivityNotification[];
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function markRead(id?: string) {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(id ? { id } : { all: true }),
        });
        await readApiJson<{ ok?: boolean }>(response, "标记通知失败。");
        const now = new Date().toISOString();
        setItems((current) =>
          current.map((item) =>
            !id || item.id === id ? { ...item, read_at: item.read_at ?? now } : item,
          ),
        );
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "标记通知失败。");
      }
    });
  }

  return (
    <section className="notification-panel">
      <div className="notification-toolbar">
        <span>{items.filter((item) => !item.read_at).length} 条未读</span>
        <button type="button" onClick={() => markRead()} disabled={pending || items.every((item) => item.read_at)}>
          <CheckCheck size={15} /> 全部已读
        </button>
      </div>
      {error && (
        <p className="rounded-soft bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {items.length ? (
        <div className="notification-list">
          {items.map((item) => (
            <article key={item.id} className={item.read_at ? "notification-item" : "notification-item is-unread"}>
              <span className="notification-avatar" aria-hidden="true">
                {item.actor?.display_name?.slice(0, 1) ?? "♡"}
              </span>
              <div>
                <Link href={item.href} onClick={() => markRead(item.id)}>
                  {item.title}
                </Link>
                {item.body && <p>{item.body}</p>}
                <time>{formatTime(item.created_at)}</time>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="notification-empty">
          现在没有通知。等对方发新回忆、修改或追评时，这里会亮起来。
        </div>
      )}
    </section>
  );
}
