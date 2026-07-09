"use client";

import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmojiTextField } from "@/components/emoji-text-field";

type Wish = {
  id: string;
  title: string;
  description: string | null;
  isDone: boolean;
};

export function WishlistBoard({ items, isDemo }: { items: Wish[]; isDemo: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({ title: "", description: "" });
  const draftKey = "little-planet-wishlist-draft";

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) setDraft((current) => ({ ...current, ...JSON.parse(saved) }));
    } catch {
      // Local draft restore is best-effort.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Local draft persistence is best-effort.
    }
  }, [draft]);

  function run(action: () => Promise<void>) {
    setError("");
    startTransition(async () => {
      try {
        await action();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "操作失败。");
      }
    });
  }

  async function readResult(response: Response) {
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) throw new Error(result.error ?? `操作失败：${response.status}`);
  }

  async function createWishFromForm(formData: FormData) {
    const response = await fetch("/api/wishlist", {
      method: "POST",
      body: formData,
    });
    await readResult(response);
    window.localStorage.removeItem(draftKey);
    setDraft({ title: "", description: "" });
    router.refresh();
  }

  async function toggleWish(id: string, done: boolean) {
    const response = await fetch("/api/wishlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done }),
    });
    await readResult(response);
    router.refresh();
  }

  async function deleteWish(id: string) {
    const response = await fetch("/api/wishlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await readResult(response);
    router.refresh();
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[.8fr_1.2fr]">
      <form action={(formData) => run(() => createWishFromForm(formData))} className="surface h-fit rounded-[24px] p-6">
        <h2 className="font-heading text-xl font-semibold text-text">写下一个愿望</h2>
        <label className="label mt-5">
          想一起完成什么
          <EmojiTextField
            name="title"
            value={draft.title}
            onChange={(value) =>
              setDraft((current) => ({ ...current, title: value }))
            }
            maxLength={120}
            required
            emojis={["✨", "🌍", "✈️", "🍽️", "🎬", "🎡", "🏔️", "🌊", "🎂", "💕"]}
          />
        </label>
        <label className="label mt-4">
          补充说明
          <EmojiTextField
            as="textarea"
            className="min-h-24"
            name="description"
            value={draft.description}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                description: value,
              }))
            }
            maxLength={500}
          />
        </label>
        <p className="mt-3 text-xs leading-5 text-muted">愿望草稿会自动保存到这台电脑。</p>
        <button className="button-primary mt-5 h-[46px]" disabled={pending || isDemo}>
          <Plus size={17} /> 加入清单
        </button>
        {isDemo && <p className="mt-3 text-xs text-muted">演示模式暂不保存。</p>}
      </form>

      <section className="grid gap-3">
        {error && <p className="rounded-soft bg-[var(--color-accent-soft)] p-4 text-sm text-[var(--color-danger)]">{error}</p>}
        {items.map((item) => (
          <article key={item.id} className={`surface flex items-start gap-4 rounded-[20px] p-5 transition hover:-translate-y-0.5 ${item.isDone ? "opacity-65" : ""}`}>
            <button
              className="button-secondary size-10 shrink-0 !rounded-[13px] !p-0"
              disabled={pending || isDemo}
              onClick={() => run(() => toggleWish(item.id, !item.isDone))}
              aria-label={item.isDone ? "恢复愿望" : "完成愿望"}
            >
              {item.isDone ? <RotateCcw size={16} /> : <Check size={17} />}
            </button>
            <div className="min-w-0 flex-1">
              <h3 className={`font-heading font-semibold text-text ${item.isDone ? "line-through" : ""}`}>{item.title}</h3>
              {item.description && <p className="mt-1 text-sm leading-6 text-muted">{item.description}</p>}
            </div>
            <button
              className="button-danger size-9 !rounded-[10px] !p-0"
              disabled={pending || isDemo}
              onClick={() => {
                if (window.confirm("确定删除这个愿望吗？")) run(() => deleteWish(item.id));
              }}
              aria-label="删除愿望"
            >
              <Trash2 size={15} />
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
