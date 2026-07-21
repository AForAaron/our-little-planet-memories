"use client";

import { MessageSquarePlus } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import type { EntryFollowUp } from "@/lib/database.types";
import { readApiJson } from "@/lib/http/read-api-json";

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

type FlattenedFollowUp = {
  item: EntryFollowUp;
  depth: number;
  parent: EntryFollowUp | null;
};

function flattenFollowUps(
  items: EntryFollowUp[],
  depth = 0,
  parent: EntryFollowUp | null = null,
  result: FlattenedFollowUp[] = [],
) {
  for (const item of items) {
    result.push({ item, depth, parent });
    flattenFollowUps(item.replies ?? [], depth + 1, item, result);
  }
  return result;
}

function appendReply(
  items: EntryFollowUp[],
  parentId: string,
  reply: EntryFollowUp,
): EntryFollowUp[] {
  return items.map((item) => {
    if (item.id === parentId) {
      return { ...item, replies: [...(item.replies ?? []), reply] };
    }
    if (!item.replies?.length) return item;
    return { ...item, replies: appendReply(item.replies, parentId, reply) };
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
  const visibleEvents = useMemo(() => flattenFollowUps(events), [events]);

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
      setEvents((current) => appendReply(current, item.parent_id!, item));
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
        const result = await readApiJson<{ item?: EntryFollowUp }>(
          response,
          "追评保存失败。",
        );
        if (!result.item) throw new Error("追评保存失败：服务器没有返回新追评。");
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
    <section
      id="follow-ups"
      className="follow-up-panel"
      data-canvas-anchor="follow-ups"
    >
      <div className="follow-up-head">
        <div>
          <h2>追评</h2>
          <p>过了一段时间以后，再把新的想法和感受补在这里。</p>
        </div>
        <span>{visibleEvents.length} 条</span>
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
        {visibleEvents.length ? (
          visibleEvents.map(({ item, depth, parent }) => (
            <article
              key={item.id}
              data-canvas-anchor={`follow-up:${item.id}`}
              className={depth ? "follow-up-node is-reply" : "follow-up-node is-root"}
              style={{ marginInlineStart: `${Math.min(depth, 4) * 12}px` }}
            >
              <span className="follow-up-avatar" aria-hidden="true">
                {item.profile?.display_name?.slice(0, 1) ?? "♡"}
              </span>
              <div>
                <div className="follow-up-meta">
                  <b>{item.profile?.display_name ?? "我们"}</b>
                  {parent && <span className="follow-up-parent">回复 {parent.profile?.display_name ?? "这句话"}</span>}
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
                    回复这句话
                  </button>
                </div>
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
            <span>还没有追评。等某天再想起这里，可以回来补一句，再把话慢慢聊下去。</span>
          </div>
        )}
      </div>
    </section>
  );
}
