import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { MAX_COMMON_EMOJIS } from "@/lib/emoji/catalog";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import { getDatabase } from "@/lib/db/client";
import { profileEmojiUsage } from "@/lib/db/schema";

export type EmojiUsage = {
  emoji: string;
  useCount: number;
  lastUsedAt: string;
};

function mapUsage(row: typeof profileEmojiUsage.$inferSelect): EmojiUsage {
  return {
    emoji: row.emoji,
    useCount: row.useCount,
    lastUsedAt: row.lastUsedAt.toISOString(),
  };
}

async function requireEmojiUser() {
  if (!isLiveMode()) throw new Error("演示模式不会同步常用 Emoji。");
  const user = await getCoupleUser();
  if (!user) throw new Error("登录已失效，请重新登录。");
  return user;
}

export async function getEmojiUsage() {
  const user = await requireEmojiUser();
  const rows = await getDatabase()
    .select()
    .from(profileEmojiUsage)
    .where(eq(profileEmojiUsage.profileId, user.id))
    .orderBy(desc(profileEmojiUsage.useCount), desc(profileEmojiUsage.lastUsedAt))
    .limit(MAX_COMMON_EMOJIS);
  return rows.map(mapUsage);
}

export async function recordEmojiUsage(emoji: string) {
  const user = await requireEmojiUser();
  const now = new Date();
  const [row] = await getDatabase()
    .insert(profileEmojiUsage)
    .values({
      profileId: user.id,
      emoji,
      useCount: 1,
      lastUsedAt: now,
    })
    .onConflictDoUpdate({
      target: [profileEmojiUsage.profileId, profileEmojiUsage.emoji],
      set: {
        useCount: sql`${profileEmojiUsage.useCount} + 1`,
        lastUsedAt: now,
      },
    })
    .returning();
  return mapUsage(row);
}
