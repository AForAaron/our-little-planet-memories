import "server-only";

import { desc, eq } from "drizzle-orm";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import type { CompanionMessage } from "@/lib/database.types";
import { getDatabase } from "@/lib/db/client";
import { companionMessages, profiles } from "@/lib/db/schema";
import { normalizeInternalPath } from "@/lib/security/internal-path";
import { createActivityEvent } from "./activity-stream";
import { DEMO_COMPANION_MESSAGES } from "./demo";

type MessageRow = typeof companionMessages.$inferSelect;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function mapProfile(row: typeof profiles.$inferSelect | null) {
  return row
    ? {
        display_name: row.displayName,
        avatar_url: row.avatarUrl,
        color: row.color,
      }
    : null;
}

function mapMessage(
  row: MessageRow,
  profile: typeof profiles.$inferSelect | null,
): CompanionMessage {
  return {
    id: row.id,
    author_id: row.authorId,
    body: row.body,
    page_path: normalizeInternalPath(row.pagePath),
    page_title: row.pageTitle,
    created_at: row.createdAt.toISOString(),
    profile: mapProfile(profile),
  };
}

export async function getCompanionMessages(limit = 30) {
  if (!isLiveMode()) return DEMO_COMPANION_MESSAGES.slice(0, limit);
  const user = await getCoupleUser();
  if (!user) throw new Error("登录已失效，请重新登录。");

  const rows = await getDatabase()
    .select({ message: companionMessages, profile: profiles })
    .from(companionMessages)
    .leftJoin(profiles, eq(companionMessages.authorId, profiles.id))
    .orderBy(desc(companionMessages.createdAt), desc(companionMessages.id))
    .limit(Math.max(1, Math.min(limit, 80)));

  return rows.map((row) => mapMessage(row.message, row.profile));
}

export async function createCompanionMessage(input: {
  body?: unknown;
  pagePath?: unknown;
  pageTitle?: unknown;
}) {
  if (!isLiveMode()) return DEMO_COMPANION_MESSAGES[0] ?? null;
  const user = await getCoupleUser();
  if (!user) throw new Error("请先登录。");

  const body = cleanText(input.body, 500);
  if (!body) throw new Error("先写一句想发送的话。");
  const pagePath = normalizeInternalPath(input.pagePath);
  const pageTitle = cleanText(input.pageTitle, 140) || null;

  const [created] = await getDatabase()
    .insert(companionMessages)
    .values({
      authorId: user.id,
      body,
      pagePath,
      pageTitle,
    })
    .returning();
  await createActivityEvent({
    actorId: user.id,
    kind: "companion_message",
    sourceType: "companion_message",
    sourceId: created.id,
    pagePath,
    pageTitle,
    body,
    createdAt: created.createdAt,
  }).catch(() => undefined);
  const [profile] = await getDatabase()
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  return mapMessage(created, profile ?? null);
}
