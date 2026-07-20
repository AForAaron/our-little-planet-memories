"use client";

import { Bell, Heart, Navigation, Send, X } from "lucide-react";
import Link from "next/link";
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
  messages: CompanionMessage[];
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
  messages,
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

      <div className="companion-messages">
        {messages.length ? (
          messages.map((item) => (
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
            />
          </EmojiUsageProvider>
          <button type="submit" disabled={pending || !message.trim()} aria-label="发送">
            <Send size={16} />
          </button>
        </div>
        {error && <p className="companion-error">{error}</p>}
      </form>
    </div>
  );
}
