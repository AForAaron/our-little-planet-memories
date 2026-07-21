"use client";

import { Bell, Heart, Navigation, Send, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { EmojiTextField } from "@/components/emoji-text-field";
import { EmojiUsageProvider } from "@/components/emoji-usage-provider";
import type { CompanionMessage, PresenceState } from "@/lib/database.types";
import { normalizeInternalPath } from "@/lib/security/internal-path";

const REACTIONS = ["想再去", "记得", "抱抱", "笑死"];

type CompanionPanelProps = {
  error: string;
  isDemo: boolean;
  message: string;
  messageScrollRequest: number;
  messages: CompanionMessage[];
  notice: string;
  onClose: () => void;
  onMessageChange: (value: string) => void;
  onReaction: (reaction: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSummon: () => void;
  other?: PresenceState;
  pathname: string;
  pending: boolean;
  status: string;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function CompanionPanel({
  error,
  isDemo,
  message,
  messageScrollRequest,
  messages,
  notice,
  onClose,
  onMessageChange,
  onReaction,
  onSubmit,
  onSummon,
  other,
  pathname,
  pending,
  status,
}: CompanionPanelProps) {
  const presenceHref = normalizeInternalPath(other?.current_path);
  const messagesRef = useRef<HTMLDivElement>(null);
  const hasInitialScroll = useRef(false);
  const [showNewMessageJump, setShowNewMessageJump] = useState(false);
  const chronologicalMessages = useMemo(() => [...messages].reverse(), [messages]);
  const newestMessageId = messages[0]?.id;

  const isNearBottom = useCallback((container: HTMLDivElement) => (
    container.scrollHeight - container.scrollTop - container.clientHeight < 28
  ), []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    setShowNewMessageJump(false);
  }, []);

  useEffect(() => {
    if (!newestMessageId) return;
    const frame = requestAnimationFrame(() => {
      const container = messagesRef.current;
      if (!container) return;
      if (!hasInitialScroll.current) {
        hasInitialScroll.current = true;
        scrollToLatest("auto");
      } else if (isNearBottom(container)) {
        scrollToLatest();
      } else {
        setShowNewMessageJump(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isNearBottom, newestMessageId, scrollToLatest]);

  useEffect(() => {
    if (!messageScrollRequest) return;
    const frame = requestAnimationFrame(() => scrollToLatest());
    return () => cancelAnimationFrame(frame);
  }, [messageScrollRequest, scrollToLatest]);

  return (
    <div className="companion-card">
      <div className="companion-head">
        <div>
          <span className="companion-kicker">一起在小星球</span>
          <h2>悄悄话 · {status}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="收起共处窗口">
          <X size={17} />
        </button>
      </div>

      {other && presenceHref && (
        <Link href={presenceHref} className="companion-presence">
          <Navigation size={15} />
          <span>{other.profile?.display_name ?? "对方"}</span>
          <b>{other.page_title || other.current_path}</b>
        </Link>
      )}

      <div className="companion-messages-wrap">
        <div
          ref={messagesRef}
          className="companion-messages"
          onScroll={() => {
            const container = messagesRef.current;
            if (container && isNearBottom(container)) setShowNewMessageJump(false);
          }}
        >
        {chronologicalMessages.length ? (
          chronologicalMessages.map((item) => (
            <div key={item.id} className="companion-message">
              <span>{item.profile?.display_name?.slice(0, 1) ?? "我"}</span>
              <div>
                <p>{item.body}</p>
                <small>
                  {item.profile?.display_name ?? "我们"} · {formatTime(item.created_at)}
                  {item.page_path === pathname ? " · 来自此页" : ""}
                </small>
              </div>
            </div>
          ))
        ) : (
          <p className="companion-empty">发一句话，对方打开网页时就能看见。</p>
        )}
        </div>
        {showNewMessageJump && (
          <button type="button" className="companion-new-message" onClick={() => scrollToLatest()}>
            有新悄悄话
          </button>
        )}
      </div>

      <div className="companion-reactions" aria-label="快捷反应">
        {REACTIONS.map((reaction) => (
          <button
            key={reaction}
            type="button"
            disabled={pending}
            onClick={() => onReaction(reaction)}
          >
            <Heart size={13} /> {reaction}
          </button>
        ))}
        <button type="button" disabled={pending} onClick={onSummon}>
          <Bell size={13} /> 叫她来看
        </button>
      </div>

      <form onSubmit={onSubmit} className="companion-form">
        <div className="companion-input-row">
          <EmojiUsageProvider isDemo={isDemo}>
            <EmojiTextField
              value={message}
              onChange={onMessageChange}
              placeholder="写一句只属于小窗的悄悄话"
              maxLength={500}
              className="companion-message-input"
              autoFocus
            />
          </EmojiUsageProvider>
          <button type="submit" disabled={pending || !message.trim()} aria-label="发送">
            <Send size={16} />
          </button>
        </div>
        {notice && <p className="companion-notice" aria-live="polite">{notice}</p>}
        {error && <p className="companion-error" aria-live="polite">{error}</p>}
      </form>
    </div>
  );
}
