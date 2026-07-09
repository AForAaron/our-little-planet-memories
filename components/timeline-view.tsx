"use client";

import { ArrowRight, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Entry, EntryCategory } from "@/lib/database.types";
import { formatDate } from "@/lib/utils";
import { EntryForm } from "./entry-form";

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
  currentUserId,
  openNew = false,
  isDemo = false,
  defaultCategory = "moment",
}: {
  entries: Entry[];
  currentUserId?: string;
  openNew?: boolean;
  isDemo?: boolean;
  defaultCategory?: EntryCategory;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Entry | "new" | null>(openNew ? "new" : null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

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
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "删除失败，请稍后重试。");
      }
    });
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[15px] leading-7 text-muted">
          共收藏了 <b className="text-[var(--color-accent)]">{entries.length}</b> 段故事。
        </p>
        <button className="button-primary h-[46px] px-5" onClick={() => setEditing("new")}>
          <Plus size={16} /> 写一段回忆
        </button>
      </div>

      {error && <p className="mb-5 rounded-soft bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {entries.length ? (
        <div className="relative">
          {entries.map((entry) => {
            const canEdit = !isDemo;
            const date = dateParts(entry.happened_at);
            const firstMedia = entry.media?.find((media) => media.display_url);
            const mediaCount = entry.media?.length ?? 0;
            return (
              <article key={entry.id} className="grid grid-cols-[4.8rem_2rem_minmax(0,1fr)] gap-0 sm:grid-cols-[7.25rem_2.75rem_minmax(0,1fr)]">
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
                          <img src={firstMedia.display_url ?? ""} alt={firstMedia.caption ?? entry.title ?? "回忆照片"} className="h-[190px] w-full object-cover" />
                        </Link>
                      ) : firstMedia.type === "video" ? (
                        <video src={firstMedia.display_url ?? ""} controls preload="metadata" className="h-[190px] w-full bg-black object-contain" />
                      ) : (
                        <div className="flex min-h-24 items-center p-5">
                          <audio src={firstMedia.display_url ?? ""} controls preload="metadata" className="w-full" />
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
                            <button className="button-secondary size-8 !rounded-[10px] !p-0" onClick={() => setEditing(entry)} aria-label="编辑"><Pencil size={15} /></button>
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
            <button className="button-primary mt-6" onClick={() => setEditing("new")}><Plus size={18} /> 写下第一条</button>
          </div>
        </div>
      )}

      {editing && (
        <EntryForm
          entry={editing === "new" ? null : editing}
          defaultCategory={defaultCategory}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
