"use client";

import { Footprints } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useVisibilityAwarePolling } from "@/components/use-visibility-aware-polling";
import type { CompanionMessage, PresenceState } from "@/lib/database.types";

type PresenceResponse = {
  currentUserId: string | null;
  onlineAfter: string;
  recentAfter: string;
  others: PresenceState[];
};

type MessagesResponse = {
  messages: CompanionMessage[];
};

type CreateMessageResponse = {
  error?: string;
  message?: CompanionMessage | null;
};

const loadCompanionPanel = () => import("@/components/companion-panel");

const CompanionPanel = dynamic(
  () => loadCompanionPanel().then((module) => module.CompanionPanel),
  {
    ssr: false,
    loading: () => (
      <div className="companion-card" aria-busy="true" aria-live="polite">
        <p className="companion-empty">正在打开悄悄话…</p>
      </div>
    ),
  },
);

function pageTitle() {
  if (typeof document === "undefined") return "小星球";
  return document.title.replace(" · 我们的小星球", "").trim() || "小星球";
}

function relative(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  return `${Math.round(minutes / 60)} 小时前`;
}

function presenceLine(
  other: PresenceState | undefined,
  onlineAfter: string,
  recentAfter: string,
  pathname: string,
) {
  if (!other) return "等对方来小星球";
  const seenAt = new Date(other.last_seen_at).getTime();
  if (seenAt >= new Date(onlineAfter).getTime()) {
    return other.current_path === pathname
      ? "你们正在一起看这里"
      : `正在看 ${other.page_title || "另一页"}`;
  }
  if (seenAt >= new Date(recentAfter).getTime()) return `${relative(other.last_seen_at)}来过`;
  return "现在不在线";
}

export function CompanionWidget({ isDemo = false }: { isDemo?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [presence, setPresence] = useState<PresenceResponse | null>(null);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const pathnameRef = useRef(pathname);
  const openRef = useRef(open);

  pathnameRef.current = pathname;
  openRef.current = open;

  const other = presence?.others[0];
  const status = useMemo(
    () =>
      presence
        ? presenceLine(other, presence.onlineAfter, presence.recentAfter, pathname)
        : isDemo
          ? "预览小星球足迹"
          : "正在同步",
    [isDemo, other, pathname, presence],
  );

  const refreshPresence = useCallback(async (signal: AbortSignal) => {
    const currentPath = pathnameRef.current;
    try {
      const response = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPath, pageTitle: pageTitle() }),
        signal,
      });
      if (!response.ok || signal.aborted) return;
      const result = (await response.json()) as PresenceResponse;
      if (!signal.aborted && pathnameRef.current === currentPath) setPresence(result);
    } catch {
      // Presence is best-effort and is retried by the visibility-aware poller.
    }
  }, []);

  const refreshMessages = useCallback(async (signal: AbortSignal) => {
    if (!openRef.current) return;
    try {
      const response = await fetch("/api/companion/messages?limit=16", { signal });
      if (!response.ok || signal.aborted || !openRef.current) return;
      const result = (await response.json()) as MessagesResponse;
      if (!signal.aborted && openRef.current) setMessages(result.messages.slice(0, 12));
    } catch {
      // Message refreshes are best-effort and must not surface AbortError.
    }
  }, []);

  useVisibilityAwarePolling({
    enabled: true,
    intervalMs: open ? 15_000 : 30_000,
    refreshKey: pathname,
    task: refreshPresence,
  });
  useVisibilityAwarePolling({
    enabled: open,
    intervalMs: 15_000,
    refreshKey: pathname,
    task: refreshMessages,
  });

  async function createFootprintAction(input: {
    eventType: "reaction" | "summon";
    body?: string;
    reaction?: string;
  }) {
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/footprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: input.eventType,
          scope: "page",
          pagePath: pathname,
          pageTitle: pageTitle(),
          body: input.body,
          reaction: input.reaction,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "发送失败。");
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
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/companion/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text,
          pagePath: pathname,
          pageTitle: pageTitle(),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as CreateMessageResponse;
      if (!response.ok) throw new Error(result.error ?? "发送失败。");
      const createdMessage = result.message;
      if (createdMessage) {
        setMessages((current) => [
          createdMessage,
          ...current.filter((item) => item.id !== createdMessage.id),
        ].slice(0, 12));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发送失败。");
    } finally {
      setPending(false);
    }
  }

  const preloadPanel = useCallback(() => {
    void loadCompanionPanel().catch(() => undefined);
  }, []);

  return (
    <aside className={open ? "companion is-open" : "companion"} aria-label="实时共处">
      {open ? (
        <CompanionPanel
          error={error}
          isDemo={isDemo}
          message={message}
          messages={messages}
          onClose={() => setOpen(false)}
          onMessageChange={setMessage}
          onReaction={(reaction) => createFootprintAction({ eventType: "reaction", reaction })}
          onSubmit={submit}
          onSummon={() => createFootprintAction({ eventType: "summon", body: "来看看这里" })}
          other={other}
          pathname={pathname}
          pending={pending}
          status={status}
        />
      ) : (
        <button
          className="companion-bubble"
          type="button"
          onPointerEnter={preloadPanel}
          onFocus={preloadPanel}
          onClick={() => {
            preloadPanel();
            setOpen(true);
          }}
        >
          <span className="companion-dot" />
          <Footprints size={18} />
          <span>{status}</span>
        </button>
      )}
    </aside>
  );
}
