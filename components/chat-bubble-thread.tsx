"use client";

import { Check, ImageIcon, Scissors } from "lucide-react";

export type ChatBubbleMedia = {
  kind?: string;
  sourcePath?: string;
  url?: string;
  blocked?: boolean;
  label?: string;
};

export type ChatBubbleMessage = {
  id: string;
  senderRole: "self" | "partner" | "system";
  senderDisplayName?: string;
  sentAt: string;
  renderType: string;
  content: string;
  quote?: {
    title?: string | null;
    content?: string | null;
  } | null;
  media?: ChatBubbleMedia[];
};

type ChatBubbleThreadProps = {
  messages: ChatBubbleMessage[];
  mode?: "detail" | "review";
  selectedIds?: Set<string>;
  selectedMediaPaths?: Set<string>;
  selfLabel?: string;
  partnerLabel?: string;
  getMediaUrl?: (media: ChatBubbleMedia) => string;
  canSplit?: (message: ChatBubbleMessage, index: number) => boolean;
  onToggleMessage?: (messageId: string) => void;
  onSplitMessage?: (messageId: string) => void;
};

function formatTime(value: string, withDate = false) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: withDate ? "2-digit" : undefined,
    day: withDate ? "2-digit" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function shouldShowTime(previous: ChatBubbleMessage | undefined, current: ChatBubbleMessage) {
  if (!previous) return true;
  return (
    new Date(current.sentAt).getTime() - new Date(previous.sentAt).getTime() >
    30 * 60 * 1000
  );
}

function isImage(path: string) {
  return /\.(?:jpe?g|png|webp|gif)$/i.test(path);
}

function isVideo(path: string) {
  return /\.(?:mp4|webm)$/i.test(path);
}

function isAudio(path: string) {
  return /\.(?:wav|m4a|mp3)$/i.test(path);
}

function chatRoleLabel(role: ChatBubbleMessage["senderRole"], selfLabel: string, partnerLabel: string) {
  if (role === "self") return selfLabel.trim().slice(0, 1) || "张";
  if (role === "partner") return partnerLabel.trim().slice(0, 1) || "沈";
  return "系统";
}

function MediaPreview({
  media,
  src,
  selected,
}: {
  media: ChatBubbleMedia;
  src: string;
  selected?: boolean;
}) {
  const path = media.sourcePath ?? media.url ?? media.label ?? "";
  if (media.blocked) {
    return <span className="chat-media-fallback">已阻止危险附件</span>;
  }
  return (
    <div className="chat-media">
      {isImage(path) ? (
        // Review assets and signed URLs are already access-controlled by their routes.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : isVideo(path) ? (
        <video src={src} controls preload="metadata" />
      ) : isAudio(path) ? (
        <audio src={src} controls preload="none" />
      ) : (
        <span className="chat-media-fallback">
          <ImageIcon size={14} /> {media.label ?? media.sourcePath ?? media.kind ?? "附件"}
        </span>
      )}
      {selected !== undefined && (
        <span className={`chat-media-selected ${selected ? "is-selected" : ""}`}>
          {selected ? <Check size={11} /> : null}
          {selected ? "媒体已精选" : "媒体未精选"}
        </span>
      )}
    </div>
  );
}

export function ChatBubbleThread({
  messages,
  mode = "detail",
  selectedIds,
  selectedMediaPaths,
  selfLabel = "我",
  partnerLabel = "她",
  getMediaUrl,
  canSplit,
  onToggleMessage,
  onSplitMessage,
}: ChatBubbleThreadProps) {
  return (
    <div className={`chat-thread ${mode === "review" ? "is-review" : ""}`}>
      {messages.map((message, index) => {
        const selected = selectedIds?.has(message.id) ?? true;
        const side =
          message.senderRole === "system"
            ? "system"
            : message.senderRole === "self"
              ? "self"
              : "partner";
        const name = chatRoleLabel(message.senderRole, selfLabel, partnerLabel);

        return (
          <div key={message.id} className="chat-message-wrap">
            {shouldShowTime(messages[index - 1], message) && (
              <div className="chat-time-divider">{formatTime(message.sentAt, true)}</div>
            )}
            <article className={`chat-message ${side} ${selected ? "" : "is-unselected"}`}>
              {mode === "review" && message.senderRole !== "system" && (
                <label className="chat-select">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleMessage?.(message.id)}
                    aria-label="是否保留这条原文"
                  />
                </label>
              )}
              {message.senderRole !== "system" && (
                <div className="chat-avatar" aria-hidden="true">
                  {name.slice(0, 1)}
                </div>
              )}
              <div className="chat-stack">
                {message.senderRole !== "system" && (
                  <div className="chat-meta">
                    <span>{name}</span>
                    <time>{formatTime(message.sentAt)}</time>
                    {mode === "review" && <span>{message.renderType}</span>}
                    {mode === "review" && canSplit?.(message, index) && (
                      <button
                        className="review-text-button"
                        type="button"
                        onClick={() => onSplitMessage?.(message.id)}
                      >
                        <Scissors size={12} /> 从这里拆分
                      </button>
                    )}
                  </div>
                )}
                <div className="chat-bubble">
                  {message.senderRole === "system" ? (
                    <span>{message.content || `[${message.renderType}]`}</span>
                  ) : (
                    <>
                      {message.quote && (message.quote.title || message.quote.content) && (
                        <blockquote className="chat-quote">
                          {message.quote.title ? <b>{message.quote.title}：</b> : null}
                          {message.quote.content}
                        </blockquote>
                      )}
                      {message.content ? (
                        <p>{message.content}</p>
                      ) : (
                        <p className="chat-fallback">[{message.renderType}]</p>
                      )}
                      {message.media?.length ? (
                        <div className="chat-media-grid">
                          {message.media.map((media, mediaIndex) => {
                            const src = getMediaUrl?.(media) ?? media.url ?? "";
                            const mediaSelected = media.sourcePath
                              ? selectedMediaPaths?.has(media.sourcePath)
                              : undefined;
                            return src || media.blocked ? (
                              <MediaPreview
                                key={`${message.id}:${media.sourcePath ?? mediaIndex}`}
                                media={media}
                                src={src}
                                selected={mode === "review" ? mediaSelected : undefined}
                              />
                            ) : null;
                          })}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
