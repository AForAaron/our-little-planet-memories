"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_COMMON_EMOJIS, isSupportedEmoji, MAX_COMMON_EMOJIS } from "@/lib/emoji/catalog";

export type EmojiUsageItem = {
  emoji: string;
  useCount: number;
  lastUsedAt: string;
};

type EmojiUsageContextValue = {
  commonEmojis: string[];
  recordEmoji: (emoji: string) => void;
};

const STORAGE_KEY = "little-planet-emoji-usage";

const EmojiUsageContext = createContext<EmojiUsageContextValue>({
  commonEmojis: [...DEFAULT_COMMON_EMOJIS],
  recordEmoji: () => undefined,
});

function sortUsage(items: EmojiUsageItem[]) {
  return [...items].sort((left, right) =>
    right.useCount - left.useCount ||
    new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime() ||
    left.emoji.localeCompare(right.emoji),
  );
}

function toCommonEmojis(items: EmojiUsageItem[]) {
  const used = sortUsage(items).map((item) => item.emoji);
  return [...used, ...DEFAULT_COMMON_EMOJIS.filter((emoji) => !used.includes(emoji))]
    .slice(0, MAX_COMMON_EMOJIS);
}

function readLocalUsage(): EmojiUsageItem[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(saved)) return [];
    return saved.flatMap((item) => {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.emoji !== "string" ||
        !isSupportedEmoji(item.emoji) ||
        typeof item.useCount !== "number" ||
        typeof item.lastUsedAt !== "string"
      ) {
        return [];
      }
      return [{
        emoji: item.emoji,
        useCount: Math.max(0, Math.floor(item.useCount)),
        lastUsedAt: item.lastUsedAt,
      }];
    });
  } catch {
    return [];
  }
}

function upsertUsage(items: EmojiUsageItem[], emoji: string, item?: EmojiUsageItem) {
  const existing = items.find((current) => current.emoji === emoji);
  const next = item ?? {
    emoji,
    useCount: (existing?.useCount ?? 0) + 1,
    lastUsedAt: new Date().toISOString(),
  };
  return [...items.filter((current) => current.emoji !== emoji), next];
}

export function EmojiUsageProvider({
  children,
  isDemo,
}: {
  children: React.ReactNode;
  isDemo: boolean;
}) {
  const [items, setItems] = useState<EmojiUsageItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const syncQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    setHydrated(false);
    if (isDemo) {
      setItems(readLocalUsage());
      setHydrated(true);
      return () => {
        active = false;
      };
    }

    void fetch("/api/emoji-usage", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("无法读取常用 Emoji。");
        return response.json() as Promise<{ items?: EmojiUsageItem[] }>;
      })
      .then((payload) => {
        if (active) setItems(Array.isArray(payload.items) ? payload.items : []);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [isDemo]);

  useEffect(() => {
    if (!isDemo || !hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Demo preferences are best-effort.
    }
  }, [hydrated, isDemo, items]);

  const recordEmoji = useCallback((emoji: string) => {
    setItems((current) => upsertUsage(current, emoji));
    if (isDemo) return;

    syncQueue.current = syncQueue.current
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch("/api/emoji-usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
        const payload = (await response.json().catch(() => ({}))) as { item?: EmojiUsageItem };
        if (!response.ok || !payload.item) throw new Error("无法同步常用 Emoji。");
        setItems((current) => {
          const known = current.find((candidate) => candidate.emoji === emoji);
          if (known && known.useCount > payload.item!.useCount) return current;
          return upsertUsage(current, emoji, payload.item);
        });
      })
      .catch(() => undefined);
  }, [isDemo]);

  const value = useMemo<EmojiUsageContextValue>(() => ({
    commonEmojis: toCommonEmojis(items),
    recordEmoji,
  }), [items, recordEmoji]);

  return <EmojiUsageContext.Provider value={value}>{children}</EmojiUsageContext.Provider>;
}

export function useEmojiUsage() {
  return useContext(EmojiUsageContext);
}
