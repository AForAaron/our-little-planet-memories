import "server-only";

import { asc, eq } from "drizzle-orm";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import type { EntryFollowUp } from "@/lib/database.types";
import { getDatabase } from "@/lib/db/client";
import {
  entries,
  entryFollowUps,
  profiles,
} from "@/lib/db/schema";
import { DEMO_ENTRY_FOLLOW_UPS } from "./demo";
import { completeEntryAttention, createActivityEvent } from "./activity-stream";
import { createPartnerNotification } from "./notifications";

type FollowUpRow = typeof entryFollowUps.$inferSelect;

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

function mapFollowUp(
  row: FollowUpRow,
  profile: typeof profiles.$inferSelect | null,
): EntryFollowUp {
  return {
    id: row.id,
    entry_id: row.entryId,
    author_id: row.authorId,
    parent_id: row.parentId,
    body: row.body,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    profile: mapProfile(profile),
  };
}

function buildTree(items: EntryFollowUp[]) {
  const roots: EntryFollowUp[] = [];
  const byId = new Map<string, EntryFollowUp>();
  for (const item of items) {
    item.replies = [];
    byId.set(item.id, item);
  }
  for (const item of items) {
    if (item.parent_id) {
      const parent = byId.get(item.parent_id);
      if (parent && !wouldCreateCycle(item.id, parent.id, byId)) {
        parent.replies ??= [];
        parent.replies.push(item);
      } else {
        roots.push(item);
      }
    } else {
      roots.push(item);
    }
  }
  return roots;
}

function wouldCreateCycle(
  itemId: string,
  parentId: string,
  byId: Map<string, EntryFollowUp>,
) {
  const visited = new Set<string>([itemId]);
  let currentId: string | null = parentId;
  while (currentId) {
    if (visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = byId.get(currentId)?.parent_id ?? null;
  }
  return false;
}

export async function getEntryFollowUps(entryId: string) {
  if (!isLiveMode()) {
    return DEMO_ENTRY_FOLLOW_UPS.filter((item) => item.entry_id === entryId);
  }
  const user = await getCoupleUser();
  if (!user) throw new Error("登录已失效，请重新登录。");

  const rows = await getDatabase()
    .select({ followUp: entryFollowUps, profile: profiles })
    .from(entryFollowUps)
    .leftJoin(profiles, eq(entryFollowUps.authorId, profiles.id))
    .where(eq(entryFollowUps.entryId, entryId))
    .orderBy(asc(entryFollowUps.createdAt));

  return buildTree(rows.map((row) => mapFollowUp(row.followUp, row.profile)));
}

export async function createEntryFollowUp(input: {
  entryId: string;
  body?: unknown;
  parentId?: unknown;
}) {
  if (!isLiveMode()) return DEMO_ENTRY_FOLLOW_UPS[0] ?? null;
  const user = await getCoupleUser();
  if (!user) throw new Error("请先登录。");

  const body = cleanText(input.body, 500);
  if (!body) throw new Error("先写一点想追加的感受。");
  const parentId = cleanText(input.parentId, 80) || null;
  const db = getDatabase();

  const [entry] = await db
    .select({
      id: entries.id,
      title: entries.title,
      authorId: entries.authorId,
    })
    .from(entries)
    .where(eq(entries.id, input.entryId))
    .limit(1);
  if (!entry) throw new Error("没有找到这条回忆。");

  let parent: FollowUpRow | null = null;
  if (parentId) {
    const [parentRow] = await db
      .select()
      .from(entryFollowUps)
      .where(eq(entryFollowUps.id, parentId))
      .limit(1);
    if (!parentRow || parentRow.entryId !== input.entryId) {
      throw new Error("没有找到要回复的追评。");
    }
    parent = parentRow;
  }

  const now = new Date();
  const [created] = await db
    .insert(entryFollowUps)
    .values({
      entryId: input.entryId,
      authorId: user.id,
      parentId,
      body,
      updatedAt: now,
    })
    .returning();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const title = entry.title || "无题回忆";
  await createActivityEvent({
    actorId: user.id,
    kind: parent ? "follow_up_replied" : "follow_up_created",
    sourceType: "entry_follow_up",
    sourceId: created.id,
    entryId: input.entryId,
    pagePath: `/memories/${input.entryId}`,
    pageTitle: title,
    body,
    createdAt: created.createdAt,
  }).catch(() => undefined);
  await completeEntryAttention(input.entryId).catch(() => undefined);
  const repliesToPartner = Boolean(parent && parent.authorId !== user.id);
  const notificationTitle = parent
    ? repliesToPartner
      ? `${profile?.displayName ?? "对方"} 回复了你的追评`
      : `${profile?.displayName ?? "对方"} 在《${title}》里继续说了下去`
    : `${profile?.displayName ?? "对方"} 追评了《${title}》`;
  const recipientId = repliesToPartner ? parent!.authorId : null;

  await createPartnerNotification({
    actorId: user.id,
    recipientId,
    type: parent ? "follow_up_replied" : "follow_up_created",
    entryId: input.entryId,
    followUpId: created.id,
    title: notificationTitle,
    body,
    href: `/memories/${input.entryId}#follow-ups`,
  }).catch(() => undefined);

  return {
    ...mapFollowUp(created, profile ?? null),
    replies: [],
  };
}

export async function getFollowUpNotificationRecipients(entryId: string) {
  const rows = await getDatabase()
    .select({ authorId: entryFollowUps.authorId })
    .from(entryFollowUps)
    .where(eq(entryFollowUps.entryId, entryId));
  return Array.from(new Set(rows.map((row) => row.authorId)));
}
