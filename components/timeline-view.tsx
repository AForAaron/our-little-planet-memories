"use client";

import { CalendarDays, ImageIcon, Pencil, Plus, Smile, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Entry, EntryCategory } from "@/lib/database.types";
import { formatDate } from "@/lib/utils";
import { EntryForm } from "./entry-form";

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
        <p className="text-sm text-muted">共收藏了 <b className="text-text">{entries.length}</b> 段故事</p>
        <button className="button-primary" onClick={() => setEditing("new")}>
          <Plus size={18} /> 写一段回忆
        </button>
      </div>

      {error && <p className="mb-5 rounded-soft bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {entries.length ? (
        <div className="relative ml-2 border-l border-line pb-4 sm:ml-28">
          {entries.map((entry) => {
            const canEdit = !isDemo;
            return (
              <article key={entry.id} className="relative pb-8 pl-7 sm:pl-10">
                <span className="absolute -left-[.42rem] top-7 size-3 rounded-full border-[3px] border-background bg-accent ring-2 ring-[var(--color-accent-soft)]" />
                <time className="mb-2 block text-xs font-semibold text-muted sm:absolute sm:-left-28 sm:top-6 sm:w-20 sm:text-right">
                  {new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(entry.happened_at))}
                  <span className="block font-normal">{new Date(entry.happened_at).getFullYear()}</span>
                </time>
                <div className="surface overflow-hidden">
                  {entry.media?.length ? (
                    <div className={`grid ${entry.media.length > 1 ? "grid-cols-2" : ""}`}>
                      {entry.media.map((media) => media.display_url && (
                        media.type === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={media.id} src={media.display_url} alt={media.caption ?? entry.title ?? "回忆照片"} className="h-56 w-full object-cover sm:h-72" />
                        ) : media.type === "video" ? (
                          <video key={media.id} src={media.display_url} controls preload="metadata" className="h-56 w-full bg-black object-contain sm:h-72" />
                        ) : (
                          <div key={media.id} className="flex min-h-24 items-center p-5">
                            <audio src={media.display_url} controls preload="metadata" className="w-full" />
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="photo-placeholder flex h-28 items-center justify-center text-accent">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                          <span className="flex items-center gap-1.5"><CalendarDays size={14} />{formatDate(entry.happened_at, true)}</span>
                          {entry.mood && <span className="flex items-center gap-1.5"><Smile size={14} />{entry.mood}</span>}
                        </div>
                        <h2 className="font-heading text-xl font-bold">
                          <Link href={`/memories/${entry.id}`} className="hover:text-accent">
                            {entry.title || "无题回忆"}
                          </Link>
                        </h2>
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 gap-1">
                          <button className="button-secondary size-9 !p-0" onClick={() => setEditing(entry)} aria-label="编辑"><Pencil size={15} /></button>
                          <button className="button-danger size-9 !p-0" onClick={() => remove(entry)} disabled={pending} aria-label="删除"><Trash2 size={15} /></button>
                        </div>
                      )}
                    </div>
                    {entry.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted">{entry.body}</p>}
                    <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-4 text-xs text-muted">
                      <span className="grid size-7 place-items-center rounded-full bg-[var(--color-accent-soft)] font-heading font-bold text-accent">
                        {entry.profiles?.display_name?.slice(0, 1) ?? "♡"}
                      </span>
                      <span>由 {entry.profiles?.display_name ?? "我们"} 写下</span>
                      {entry.updated_by_profile &&
                        entry.updated_by_profile.display_name !== entry.profiles?.display_name && (
                          <span>· {entry.updated_by_profile.display_name} 最后编辑</span>
                        )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="surface grid min-h-80 place-items-center p-8 text-center">
          <div>
            <span className="mx-auto grid size-16 place-items-center rounded-theme bg-[var(--color-accent-soft)] text-accent"><CalendarDays size={28} /></span>
            <h2 className="mt-5 font-heading text-xl font-bold">故事的第一页还是空白</h2>
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
