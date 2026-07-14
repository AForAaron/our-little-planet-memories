"use client";

import { ArrowRight, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Entry, EntryCategory } from "@/lib/database.types";
import { formatDate } from "@/lib/utils";
import type { EntrySavedPayload, LazyEntryFormProps } from "./lazy-entry-form";

const PAGE_SIZE = 24;
const EMPTY_ENTRIES: Entry[] = [];

const LazyEntryForm = dynamic<LazyEntryFormProps>(
  () => import("./lazy-entry-form").then((module) => module.LazyEntryForm),
  {
    ssr: false,
    loading: () => (
      <div className="modal-backdrop" role="status" aria-live="polite">
        <div className="surface rounded-[22px] px-6 py-5 text-sm text-muted">
          正在打开编辑器…
        </div>
      </div>
    ),
  },
);

type EntryMedia = NonNullable<Entry["media"]>[number];

function mediaThumbnailUrl(media: EntryMedia) {
  return media.thumbnail_url;
}

function mediaPreviewUrl(media: EntryMedia) {
  return mediaThumbnailUrl(media) ?? media.display_url;
}

function preloadEntryForm() {
  void import("./lazy-entry-form");
}

function dateParts(value: string) {
  const date = new Date(value);
  return {
    monthDay: new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    }).format(date).replace("/", "."),
    year: String(date.getFullYear()),
  };
}

export function TimelineView({
  entries,
  items,
  currentUserId,
  openNew = false,
  isDemo = false,
  defaultCategory = "moment",
  categories,
  nextCursor = null,
  total,
}: {
  /** `items` is the paginated API shape; `entries` remains compatible with existing pages. */
  entries?: Entry[];
  items?: Entry[];
  currentUserId?: string;
  openNew?: boolean;
  isDemo?: boolean;
  defaultCategory?: EntryCategory;
  categories?: EntryCategory[];
  nextCursor?: string | null;
  total?: number;
}) {
  const sourceEntries = items ?? entries ?? EMPTY_ENTRIES;
  const [editing, setEditing] = useState<Entry | "new" | null>(openNew ? "new" : null);
  const [timelineEntries, setTimelineEntries] = useState<Entry[]>(sourceEntries);
  const [cursor, setCursor] = useState<string | null>(nextCursor);
  const [entryTotal, setEntryTotal] = useState(total ?? sourceEntries.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreInFlight = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    setTimelineEntries(sourceEntries);
    setCursor(nextCursor);
    setEntryTotal(total ?? sourceEntries.length);
  }, [nextCursor, sourceEntries, total]);

  function openEditor(entry: Entry | "new") {
    preloadEntryForm();
    setEditing(entry);
  }

  function mergeSavedEntry(saved: EntrySavedPayload) {
    const leavesCurrentCategory = categories?.length && !categories.includes(saved.category);
    if (leavesCurrentCategory) {
      setEntryTotal((current) => Math.max(0, current - 1));
    }
    setTimelineEntries((current) => {
      const next = leavesCurrentCategory
        ? current.filter((entry) => entry.id !== saved.id)
        : current.map((entry) => entry.id === saved.id ? { ...entry, ...saved } : entry);
      return [...next].sort(
        (left, right) => new Date(right.happened_at).getTime() - new Date(left.happened_at).getTime(),
      );
    });
  }

  function remove(entry: Entry) {
    if (!window.confirm(`确定要删除「${entry.title || "这条回忆"}」吗？删除后无法恢复。`)) return;
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/entries", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: entry.id }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!response.ok) throw new Error(result.error ?? "删除失败，请稍后重试。");
        setTimelineEntries((current) => current.filter((item) => item.id !== entry.id));
        setEntryTotal((current) => Math.max(0, current - 1));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "删除失败，请稍后重试。");
      }
    });
  }

  async function loadMore() {
    if (!cursor || loadMoreInFlight.current) return;
    loadMoreInFlight.current = true;
    setError("");
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        cursor,
        limit: String(PAGE_SIZE),
      });
      if (categories?.length) params.set("categories", categories.join(","));

      const response = await fetch(`/api/entries?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        items?: Entry[];
        nextCursor?: string | null;
        total?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "加载更多回忆失败，请稍后重试。");

      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      setTimelineEntries((current) => {
        const knownIds = new Set(current.map((entry) => entry.id));
        return [...current, ...nextItems.filter((entry) => !knownIds.has(entry.id))];
      });
      setCursor(payload.nextCursor ?? null);
      if (typeof payload.total === "number") setEntryTotal(payload.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载更多回忆失败，请稍后重试。");
    } finally {
      loadMoreInFlight.current = false;
      setLoadingMore(false);
    }
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[15px] leading-7 text-muted">
          共收藏了 <b className="text-[var(--color-accent)]">{entryTotal}</b> 段故事。
        </p>
        <button
          className="button-primary h-[46px] px-5"
          onMouseEnter={preloadEntryForm}
          onFocus={preloadEntryForm}
          onClick={() => openEditor("new")}
        >
          <Plus size={16} /> 写一段回忆
        </button>
      </div>

      {error && <p className="mb-5 rounded-soft bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {timelineEntries.length ? (
        <div className="relative">
          {timelineEntries.map((entry, index) => {
            const canEdit = !isDemo;
            const date = dateParts(entry.happened_at);
            const firstMedia = entry.media?.find((media) => mediaPreviewUrl(media));
            const mediaCount = entry.media_count ?? entry.media?.length ?? 0;
            return (
              <article
                key={entry.id}
                className="grid grid-cols-[4.8rem_2rem_minmax(0,1fr)] gap-0 sm:grid-cols-[7.25rem_2.75rem_minmax(0,1fr)]"
                style={index > 2 ? { contentVisibility: "auto", containIntrinsicSize: "320px" } : undefined}
              >
                <time className="pt-5 text-right">
                  <span className="block font-heading text-xl font-semibold text-text sm:text-[22px]">{date.monthDay}</span>
                  <span className="mt-1 block font-mono text-[11px] text-muted">{date.year}</span>
                </time>
                <div className="relative flex justify-center">
                  <div className="h-full w-px bg-gradient-to-b from-[var(--color-accent-soft)] to-[var(--color-line)]" />
                  <span className="absolute top-6 size-4 rounded-full border-[3px] border-[var(--color-surface)] bg-[var(--color-accent)] shadow-[0_0_0_5px_var(--color-accent-soft)]" />
                </div>
                <div className="pb-8 pl-2">
                  <div className="surface overflow-hidden rounded-[22px] transition hover:-translate-y-1 hover:shadow-lift">
                    {firstMedia ? (
                      firstMedia.type === "image" ? (
                        <Link href={`/memories/${entry.id}`} className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={mediaPreviewUrl(firstMedia) ?? ""}
                            alt={firstMedia.caption ?? entry.title ?? "回忆照片"}
                            width={firstMedia.width ?? 640}
                            height={firstMedia.height ?? 480}
                            loading={index === 0 ? "eager" : "lazy"}
                            decoding="async"
                            fetchPriority={index === 0 ? "high" : "auto"}
                            sizes="(min-width: 640px) 850px, calc(100vw - 7rem)"
                            className="h-[190px] w-full object-cover"
                          />
                        </Link>
                      ) : firstMedia.type === "video" ? (
                        <video
                          src={firstMedia.display_url ?? ""}
                          poster={mediaThumbnailUrl(firstMedia) ?? "/brand/donut-planet-192.png"}
                          controls
                          preload="none"
                          width={firstMedia.width ?? 640}
                          height={firstMedia.height ?? 480}
                          className="h-[190px] w-full bg-black object-contain"
                        />
                      ) : (
                        <div className="flex min-h-24 items-center p-5">
                          <audio src={firstMedia.display_url ?? ""} controls preload="none" className="w-full" />
                        </div>
                      )
                    ) : (
                      <Link href={`/memories/${entry.id}`} className="photo-placeholder flex h-[118px] items-center justify-center text-muted">
                        <ImageIcon size={26} />
                      </Link>
                    )}
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="font-heading text-xl font-semibold text-text">
                            <Link href={`/memories/${entry.id}`} className="hover:text-[var(--color-accent-strong)]">
                              {entry.title || "无题回忆"}
                            </Link>
                          </h2>
                          <p className="mt-2 text-xs text-muted">{formatDate(entry.happened_at, true)}{entry.mood ? ` · ${entry.mood}` : ""}</p>
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              className="button-secondary size-8 !rounded-[10px] !p-0"
                              onMouseEnter={preloadEntryForm}
                              onFocus={preloadEntryForm}
                              onClick={() => openEditor(entry)}
                              aria-label="编辑"
                            ><Pencil size={15} /></button>
                            <button className="button-danger size-8 !rounded-[10px] !p-0" onClick={() => remove(entry)} disabled={pending} aria-label="删除"><Trash2 size={15} /></button>
                          </div>
                        )}
                      </div>
                      {entry.body && <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-[13.5px] leading-7 text-muted">{entry.body}</p>}
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
                        <span className="inline-flex items-center gap-2">
                          <span className="grid size-[22px] place-items-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-strong)] text-[11px] text-[var(--color-on-accent)]">
                            {entry.profiles?.display_name?.slice(0, 1) ?? "♡"}
                          </span>
                          由 {entry.profiles?.display_name ?? "我们"} 记录
                          {entry.updated_by_profile &&
                            entry.updated_by_profile.display_name !== entry.profiles?.display_name && (
                              <span> · {entry.updated_by_profile.display_name} 编辑</span>
                            )}
                        </span>
                        <Link href={`/memories/${entry.id}`} className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-accent-strong)] hover:text-accent">
                          查看详情{mediaCount > 1 ? ` · ${mediaCount} 个媒体` : ""}
                          <ArrowRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="surface grid min-h-80 place-items-center rounded-[22px] p-8 text-center">
          <div>
            <span className="mx-auto grid size-16 place-items-center rounded-[18px] bg-[var(--color-accent-soft)] text-accent"><ImageIcon size={28} /></span>
            <h2 className="mt-5 font-heading text-xl font-semibold text-text">故事的第一页还是空白</h2>
            <p className="mt-2 text-sm text-muted">从最近一次让你们笑起来的小事开始吧。</p>
            <button
              className="button-primary mt-6"
              onMouseEnter={preloadEntryForm}
              onFocus={preloadEntryForm}
              onClick={() => openEditor("new")}
            ><Plus size={18} /> 写下第一条</button>
          </div>
        </div>
      )}

      {cursor && (
        <div className="mt-2 flex flex-col items-center gap-3 pb-4">
          <button
            type="button"
            className="button-secondary min-w-32"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
          <span className="text-xs text-muted">
            已显示 {timelineEntries.length} / {entryTotal} 段故事
          </span>
        </div>
      )}

      {editing && (
        <LazyEntryForm
          entry={editing === "new" ? null : editing}
          defaultCategory={defaultCategory}
          isDemo={isDemo}
          onSaved={mergeSavedEntry}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
