"use client";

import {
  Bell,
  Footprints,
  Heart,
  MessageCircle,
  Navigation,
  Send,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { EmojiTextField } from "@/components/emoji-text-field";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { FootprintEvent, PresenceState } from "@/lib/database.types";

type PresenceResponse = {
  currentUserId: string | null;
  onlineAfter: string;
  recentAfter: string;
  others: PresenceState[];
};

type FootprintsResponse = {
  events: FootprintEvent[];
};

const REACTIONS = ["想再去", "记得", "抱抱", "笑死"];

function pageTitle() {
  return document.title.replace(" · 我们的小星球", "").trim() || "小星球";
}

function relative(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  return `${Math.round(minutes / 60)} 小时前`;
}

function presenceLine(other: PresenceState | undefined, onlineAfter: string, recentAfter: string) {
  if (!other) return "等对方来小星球";
  const seenAt = new Date(other.last_seen_at).getTime();
  if (seenAt >= new Date(onlineAfter).getTime()) {
    return other.current_path === window.location.pathname
      ? "你们正在一起看这里"
      : `正在看 ${other.page_title || "另一页"}`;
  }
  if (seenAt >= new Date(recentAfter).getTime()) return `${relative(other.last_seen_at)}来过`;
  return "现在不在线";
}

export function CompanionWidget({ isDemo = false }: { isDemo?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [presence, setPresence] = useState<PresenceResponse | null>(null);
  const [events, setEvents] = useState<FootprintEvent[]>([]);
  const [message, setMessage] = useState("");
  const [leaveOnPage, setLeaveOnPage] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const other = presence?.others[0];
  const status = useMemo(
    () =>
      presence
        ? presenceLine(other, presence.onlineAfter, presence.recentAfter)
        : isDemo
          ? "预览小星球足迹"
          : "正在同步",
    [isDemo, other, presence],
  );

  async function refreshPresence(signal?: AbortSignal) {
    const response = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPath: pathname, pageTitle: pageTitle() }),
      signal,
    });
    if (!response.ok) return;
    setPresence((await response.json()) as PresenceResponse);
  }

  async function refreshEvents(signal?: AbortSignal) {
    const response = await fetch("/api/footprints?includeInstant=1&limit=12", {
      signal,
    });
    if (!response.ok) return;
    const result = (await response.json()) as FootprintsResponse;
    setEvents(result.events.filter((event) => event.event_type === "message").slice(0, 8));
  }

  useEffect(() => {
    const controller = new AbortController();
    void refreshPresence(controller.signal);
    void refreshEvents(controller.signal);
    const presenceTimer = window.setInterval(() => {
      void refreshPresence();
    }, 4_000);
    const eventTimer = window.setInterval(() => {
      void refreshEvents();
    }, 5_000);
    return () => {
      controller.abort();
      window.clearInterval(presenceTimer);
      window.clearInterval(eventTimer);
    };
  }, [pathname]);

  async function createEvent(input: {
    eventType: "message" | "reaction" | "summon";
    body?: string;
    reaction?: string;
    scope?: "site" | "page";
  }) {
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/footprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: input.eventType,
          scope: input.scope ?? "page",
          pagePath: pathname,
          pageTitle: pageTitle(),
          body: input.body,
          reaction: input.reaction,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "发送失败。");
      await refreshEvents();
      if ((input.scope ?? "page") === "page") router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发送失败。");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessage("");
    await createEvent({
      eventType: "message",
      body: text,
      scope: leaveOnPage ? "page" : "site",
    });
  }

  return (
    <aside className={open ? "companion is-open" : "companion"} aria-label="实时共处">
      {open ? (
        <div className="companion-card">
          <div className="companion-head">
            <div>
              <span className="companion-kicker">一起在小星球</span>
              <h2>{status}</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="收起共处窗口">
              <X size={17} />
            </button>
          </div>

          {other && (
            <Link href={other.current_path} className="companion-presence">
              <Navigation size={15} />
              <span>{other.profile?.display_name ?? "对方"}</span>
              <b>{other.page_title || other.current_path}</b>
            </Link>
          )}

          <div className="companion-messages">
            {events.length ? (
              events.map((event) => (
                <div key={event.id} className="companion-message">
                  <span>{event.profile?.display_name?.slice(0, 1) ?? "我"}</span>
                  <p>{event.body}</p>
                </div>
              ))
            ) : (
              <p className="companion-empty">发一句话，对方打开网页时就能看见。</p>
            )}
          </div>

          <div className="companion-reactions" aria-label="快捷反应">
            {REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                disabled={pending}
                onClick={() => createEvent({ eventType: "reaction", reaction })}
              >
                <Heart size={13} /> {reaction}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() => createEvent({ eventType: "summon", body: "来看看这里" })}
            >
              <Bell size={13} /> 叫她来看
            </button>
          </div>

          <form onSubmit={submit} className="companion-form">
            <label className="companion-toggle">
              <input
                type="checkbox"
                checked={leaveOnPage}
                onChange={(event) => setLeaveOnPage(event.target.checked)}
              />
              留在本页
            </label>
            <div className="companion-input-row">
              <EmojiTextField
                value={message}
                onChange={setMessage}
                placeholder="写一句即时小纸条"
                maxLength={500}
                className="companion-message-input"
              />
              <button type="submit" disabled={pending || !message.trim()} aria-label="发送">
                <Send size={16} />
              </button>
            </div>
            {error && <p className="companion-error">{error}</p>}
          </form>
        </div>
      ) : (
        <button className="companion-bubble" type="button" onClick={() => setOpen(true)}>
          <span className="companion-dot" />
          <Footprints size={18} />
          <span>{status}</span>
        </button>
      )}
    </aside>
  );
}
