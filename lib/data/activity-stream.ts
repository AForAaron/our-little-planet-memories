import "server-only";

import { and, desc, eq, inArray, isNotNull, isNull, lt, type SQL } from "drizzle-orm";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import type {
  ActivityEventKind,
  ActivityNotificationType,
  ActivityStreamFilter,
  ActivityStreamItem,
  PendingEntryAttention,
} from "@/lib/database.types";
import { getDatabase } from "@/lib/db/client";
import {
  activityEvents,
  activityNotifications,
  entries,
  profiles,
} from "@/lib/db/schema";
import { normalizeInternalPath } from "@/lib/security/internal-path";
import {
  DEMO_ACTIVITY_STREAM,
  DEMO_PENDING_ENTRY_ATTENTION,
} from "./demo";

type ActivityEventRow = typeof activityEvents.$inferSelect;

const FILTER_KINDS: Record<ActivityStreamFilter, ActivityEventKind[] | null> = {
  all: null,
  message: ["companion_message", "page_message"],
  interaction: ["reaction", "summon", "co_presence", "visit"],
  follow_up: ["follow_up_created", "follow_up_replied"],
  entry: ["entry_created", "entry_updated"],
};

function mapProfile(row: typeof profiles.$inferSelect | null) {
  return row
    ? {
        display_name: row.displayName,
        avatar_url: row.avatarUrl,
        color: row.color,
      }
    : null;
}

function mapActivityEvent(
  row: ActivityEventRow,
  profile: typeof profiles.$inferSelect | null,
  entryTitle: string | null,
): ActivityStreamItem {
  return {
    id: row.id,
    kind: row.kind as ActivityEventKind,
    source_type: row.sourceType,
    source_id: row.sourceId,
    actor_id: row.actorId,
    entry_id: row.entryId,
    page_path: normalizeInternalPath(row.pagePath),
    page_title: row.pageTitle,
    entry_title: entryTitle,
    body: row.body,
    reaction: row.reaction,
    created_at: row.createdAt.toISOString(),
    profile: mapProfile(profile),
  };
}

function normalizeLimit(value: number | undefined, fallback: number) {
  return Math.max(1, Math.min(value ?? fallback, 80));
}

function validBefore(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function streamFilter(value: unknown): ActivityStreamFilter {
  return value === "message" ||
    value === "interaction" ||
    value === "follow_up" ||
    value === "entry"
    ? value
    : "all";
}

export async function createActivityEvent(input: {
  actorId: string;
  kind: ActivityEventKind;
  sourceType: string;
  sourceId: string;
  entryId?: string | null;
  pagePath?: string | null;
  pageTitle?: string | null;
  body?: string | null;
  reaction?: string | null;
  createdAt?: Date;
}) {
  if (!isLiveMode()) return null;
  const [created] = await getDatabase()
    .insert(activityEvents)
    .values({
      actorId: input.actorId,
      kind: input.kind,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      entryId: input.entryId ?? null,
      pagePath: normalizeInternalPath(input.pagePath),
      pageTitle: input.pageTitle ?? null,
      body: input.body ?? null,
      reaction: input.reaction ?? null,
      createdAt: input.createdAt,
    })
    .onConflictDoNothing({
      target: [activityEvents.sourceType, activityEvents.sourceId],
    })
    .returning();
  return created ?? null;
}

export async function getActivityStream({
  filter,
  before,
  limit,
}: {
  filter?: unknown;
  before?: string;
  limit?: number;
} = {}) {
  const resolvedFilter = streamFilter(filter);
  const resolvedLimit = normalizeLimit(limit, 50);
  if (!isLiveMode()) {
    const allowed = FILTER_KINDS[resolvedFilter];
    const items = allowed
      ? DEMO_ACTIVITY_STREAM.filter((item) => allowed.includes(item.kind))
      : DEMO_ACTIVITY_STREAM;
    return {
      items: items.slice(0, resolvedLimit),
      nextCursor: null,
      filter: resolvedFilter,
    };
  }

  const user = await getCoupleUser();
  if (!user) throw new Error("登录已失效，请重新登录。");

  const clauses: SQL[] = [];
  const kinds = FILTER_KINDS[resolvedFilter];
  if (kinds) clauses.push(inArray(activityEvents.kind, kinds));
  const cutoff = validBefore(before);
  if (cutoff) clauses.push(lt(activityEvents.createdAt, cutoff));

  const rows = await getDatabase()
    .select({ event: activityEvents, profile: profiles, entryTitle: entries.title })
    .from(activityEvents)
    .leftJoin(profiles, eq(activityEvents.actorId, profiles.id))
    .leftJoin(entries, eq(activityEvents.entryId, entries.id))
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(activityEvents.createdAt))
    .limit(resolvedLimit);
  const items = rows.map((row) =>
    mapActivityEvent(row.event, row.profile, row.entryTitle),
  );

  return {
    items,
    nextCursor:
      items.length === resolvedLimit ? items[items.length - 1]?.created_at ?? null : null,
    filter: resolvedFilter,
  };
}

export async function getPendingEntryAttention() {
  if (!isLiveMode()) {
    return {
      unreadCount: DEMO_PENDING_ENTRY_ATTENTION.length,
      items: DEMO_PENDING_ENTRY_ATTENTION,
    };
  }

  const user = await getCoupleUser();
  if (!user) throw new Error("登录已失效，请重新登录。");

  const rows = await getDatabase()
    .select({ notification: activityNotifications, actor: profiles, entry: entries })
    .from(activityNotifications)
    .leftJoin(profiles, eq(activityNotifications.actorId, profiles.id))
    .leftJoin(entries, eq(activityNotifications.entryId, entries.id))
    .where(
      and(
        eq(activityNotifications.recipientId, user.id),
        isNull(activityNotifications.readAt),
        isNotNull(activityNotifications.entryId),
      ),
    )
    .orderBy(desc(activityNotifications.createdAt));

  const byEntry = new Map<string, PendingEntryAttention>();
  for (const row of rows) {
    const entryId = row.notification.entryId;
    if (!entryId) continue;
    const item = {
      id: row.notification.id,
      type: row.notification.type as ActivityNotificationType,
      actor_id: row.notification.actorId,
      title: row.notification.title,
      body: row.notification.body,
      href: normalizeInternalPath(row.notification.href, "/home"),
      created_at: row.notification.createdAt.toISOString(),
      actor: mapProfile(row.actor),
    };
    const existing = byEntry.get(entryId);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    byEntry.set(entryId, {
      entry_id: entryId,
      entry_title: row.entry?.title || "无题回忆",
      href: `/memories/${entryId}`,
      latest_at: item.created_at,
      items: [item],
    });
  }

  const items = Array.from(byEntry.values())
    .map((item) => ({ ...item, items: item.items.reverse() }))
    .sort((left, right) => right.latest_at.localeCompare(left.latest_at));
  return { unreadCount: items.length, items };
}

export async function completeEntryAttention(entryId: unknown) {
  if (!isLiveMode()) return { ok: true };
  const user = await getCoupleUser();
  if (!user) throw new Error("请先登录。");
  const id = typeof entryId === "string" ? entryId.trim() : "";
  if (!id) throw new Error("缺少回忆 ID。");

  await getDatabase()
    .update(activityNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(activityNotifications.recipientId, user.id),
        eq(activityNotifications.entryId, id),
        isNull(activityNotifications.readAt),
      ),
    );
  return { ok: true };
}
