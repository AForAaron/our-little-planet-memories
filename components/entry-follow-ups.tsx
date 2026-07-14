"use client";

import { MessageSquarePlus } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import type { EntryFollowUp } from "@/lib/database.types";

const loadFollowUpComposer = () => import("@/components/follow-up-composer");

const FollowUpComposer = dynamic(loadFollowUpComposer, {
  ssr: false,
  loading: () => <div className="follow-up-form text-sm text-muted">正在打开输入框…</div>,
});

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

function formatFullTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return response.text().then((text) => {
    if (!text) return {} as T & { error?: string };
    try {
      return JSON.parse(text) as T & { error?: string };
    } catch {
      const contentType = response.headers.get("content-type") ?? "";
      const looksLikeHtml = contentType.includes("text/html") || text.trimStart().startsWith("<");
      return {
        error: response.redirected || looksLikeHtml
          ? "追评接口返回了网页内容，请刷新登录状态后重试；如果仍失败，请确认线上已部署最新代码。"
          : `追评接口返回了无法读取的内容（${response.status}）。`,
      } as T & { error?: string };
    }
  });
}

export function EntryFollowUps({
  entryId,
  isDemo = false,
  pagePath,
  pageTitle,
  initialEvents,
}: {
  entryId: string;
  isDemo?: boolean;
  pagePath: string;
  pageTitle: string;
  initialEvents: EntryFollowUp[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [body, setBody] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function preloadComposer() {
    void loadFollowUpComposer();
  }

  function openComposer() {
    preloadComposer();
    setError("");
    setIsComposerOpen(true);
  }

  function closeComposer() {
    setBody("");
    setError("");
    setIsComposerOpen(false);
  }

  function openReplyComposer(id: string) {
    preloadComposer();
    setError("");
    setReplyBody("");
    setReplyTargetId((current) => current === id ? null : id);
  }

  function closeReplyComposer() {
    setReplyBody("");
    setError("");
    setReplyTargetId(null);
  }

  function insertCreated(item: EntryFollowUp) {
    if (item.parent_id) {
      setEvents((current) =>
        current.map((event) =>
          event.id === item.parent_id
            ? { ...event, replies: [...(event.replies ?? []), item] }
            : event,
        ),
      );
    } else {
      setEvents((current) => [{ ...item, replies: [] }, ...current]);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>, parentId?: string) {
    event.preventDefault();
    const content = (parentId ? replyBody : body).trim();
    if (!content) {
      setError("先写一点想追加的感受。");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/entries/${entryId}/follow-ups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentId,
            body: content,
          }),
        });
        const result = await readJson<{ item?: EntryFollowUp }>(response);
        if (!response.ok || !result.item) {
          throw new Error(result.error || "追评保存失败。");
        }
        insertCreated(result.item);
        if (parentId) {
          closeReplyComposer();
        } else {
          setBody("");
        }
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

      {isComposerOpen ? (
        <FollowUpComposer
          id="follow-up-body"
          mode="create"
          isDemo={isDemo}
          pending={pending}
          value={body}
          error={error}
          onChange={setBody}
          onCancel={closeComposer}
          onSubmit={(event) => submit(event)}
        />
      ) : (
        <button
          className="button-secondary w-fit"
          type="button"
          onClick={openComposer}
          onPointerEnter={preloadComposer}
          onFocus={preloadComposer}
        >
          <MessageSquarePlus size={16} />
          写追评
        </button>
      )}

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
                  <time title={formatFullTime(item.created_at)}>
                    {formatRelative(item.created_at)} · {formatFullTime(item.created_at)}
                  </time>
                </div>
                <p>{item.body}</p>
                <div className="follow-up-reply-tools">
                  <button
                    type="button"
                    onClick={() => openReplyComposer(item.id)}
                    onPointerEnter={preloadComposer}
                    onFocus={preloadComposer}
                  >
                    回复这条追评
                  </button>
                </div>
                {item.replies?.length ? (
                  <div className="follow-up-replies">
                    {item.replies.map((reply) => (
                      <article key={reply.id} className="follow-up-reply">
                        <span aria-hidden="true">
                          {reply.profile?.display_name?.slice(0, 1) ?? "♡"}
                        </span>
                        <div>
                          <div className="follow-up-meta">
                            <b>{reply.profile?.display_name ?? "我们"}</b>
                            <time title={formatFullTime(reply.created_at)}>
                              {formatRelative(reply.created_at)} · {formatFullTime(reply.created_at)}
                            </time>
                          </div>
                          <p>{reply.body}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
                {replyTargetId === item.id && (
                  <FollowUpComposer
                    mode="reply"
                    isDemo={isDemo}
                    pending={pending}
                    value={replyBody}
                    error={error}
                    onChange={setReplyBody}
                    onCancel={closeReplyComposer}
                    onSubmit={(event) => submit(event, item.id)}
                  />
                )}
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
