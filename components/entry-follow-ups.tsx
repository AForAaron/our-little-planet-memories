"use client";

import { MessageSquarePlus, Send } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type { FootprintEvent } from "@/lib/database.types";

function formatRelative(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return response.text().then((text) => {
    if (!text) return {} as T & { error?: string };
    try {
      return JSON.parse(text) as T & { error?: string };
    } catch {
      return { error: "服务器返回了无法读取的内容。" } as T & { error?: string };
    }
  });
}

export function EntryFollowUps({
  entryId,
  pagePath,
  pageTitle,
  initialEvents,
}: {
  entryId: string;
  pagePath: string;
  pageTitle: string;
  initialEvents: FootprintEvent[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const trimmedBody = body.trim();
  const remaining = useMemo(() => 500 - body.length, [body]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedBody) {
      setError("先写一点想追加的感受。");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/footprints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "message",
            scope: "entry",
            pagePath,
            pageTitle,
            targetType: "follow_up",
            targetId: entryId,
            body: trimmedBody,
          }),
        });
        const result = await readJson<{ event?: FootprintEvent }>(response);
        if (!response.ok || !result.event) {
          throw new Error(result.error || "追评保存失败。");
        }
        setEvents((current) => [result.event!, ...current]);
        setBody("");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "追评保存失败。");
      }
    });
  }

  return (
    <section className="follow-up-panel">
      <div className="follow-up-head">
        <div>
          <h2>追评</h2>
          <p>过了一段时间以后，再把新的想法和感受补在这里。</p>
        </div>
        <span>{events.length} 条</span>
      </div>

      <form className="follow-up-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="follow-up-body">追加追评</label>
        <textarea
          id="follow-up-body"
          className="field follow-up-textarea"
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, 500))}
          placeholder="比如：现在回头看，那天最想记住的是..."
        />
        <div className="follow-up-actions">
          <span className={remaining < 40 ? "is-low" : ""}>{remaining}</span>
          <button className="button-primary" type="submit" disabled={pending || !trimmedBody}>
            {pending ? <MessageSquarePlus className="animate-spin" size={16} /> : <Send size={16} />}
            追加
          </button>
        </div>
        {error && <p className="follow-up-error">{error}</p>}
      </form>

      <div className="follow-up-list">
        {events.length ? (
          events.map((item) => (
            <article key={item.id} className="follow-up-item">
              <span aria-hidden="true">
                {item.profile?.display_name?.slice(0, 1) ?? "♡"}
              </span>
              <div>
                <div className="follow-up-meta">
                  <b>{item.profile?.display_name ?? "我们"}</b>
                  <time>{formatRelative(item.created_at)}</time>
                </div>
                <p>{item.body}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="follow-up-empty">
            <MessageSquarePlus size={22} />
            <span>还没有追评。等某天再想起这里，可以回来补一句。</span>
          </div>
        )}
      </div>
    </section>
  );
}
