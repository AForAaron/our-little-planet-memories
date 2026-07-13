import "server-only";

import { and, desc, eq, gte, isNull, ne, or, type SQL } from "drizzle-orm";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import type {
  FootprintEvent,
  FootprintEventType,
  FootprintScope,
  PresenceState,
} from "@/lib/database.types";
import { getDatabase } from "@/lib/db/client";
import {
  footprintEvents,
  presenceState,
  profiles,
} from "@/lib/db/schema";
import { createActivityEvent } from "./activity-stream";
import { DEMO_FOOTPRINTS, DEMO_PRESENCE } from "./demo";

const ONLINE_MS = 20_000;
const RECENT_MS = 2 * 60 * 1000;

export type PresenceSummary = {
  currentUserId: string | null;
  onlineAfter: string;
  recentAfter: string;
  others: PresenceState[];
};

type FootprintRow = typeof footprintEvents.$inferSelect;
type PresenceRow = typeof presenceState.$inferSelect;

function toIso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
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

function mapPresence(row: PresenceRow, profile: typeof profiles.$inferSelect | null): PresenceState {
  return {
    user_id: row.userId,
    current_path: row.currentPath,
    page_title: row.pageTitle,
    last_seen_at: row.lastSeenAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    profile: mapProfile(profile),
  };
}

function mapFootprint(row: FootprintRow, profile: typeof profiles.$inferSelect | null): FootprintEvent {
  return {
    id: row.id,
    author_id: row.authorId,
    event_type: row.eventType as FootprintEventType,
    scope: row.scope as FootprintScope,
    page_path: row.pagePath,
    page_title: row.pageTitle,
    target_type: row.targetType,
    target_id: row.targetId,
    body: row.body,
    reaction: row.reaction,
    created_at: row.createdAt.toISOString(),
    profile: mapProfile(profile),
  };
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizePath(value: unknown) {
  const path = cleanText(value, 500) || "/";
  if (!path.startsWith("/")) return "/";
  return path.split("#")[0] || "/";
}

function normalizeScope(value: unknown): FootprintScope {
  return value === "site" ||
    value === "entry" ||
    value === "wishlist" ||
    value === "place"
    ? value
    : "page";
}

function normalizeEventType(value: unknown): FootprintEventType {
  return value === "reaction" ||
    value === "summon" ||
    value === "co_presence" ||
    value === "visit"
    ? value
    : "message";
}

export function onlineThreshold() {
  return new Date(Date.now() - ONLINE_MS);
}

export function recentThreshold() {
  return new Date(Date.now() - RECENT_MS);
}

export async function getPresenceSummary(): Promise<PresenceSummary> {
  if (!isLiveMode()) {
    return {
      currentUserId: null,
      onlineAfter: onlineThreshold().toISOString(),
      recentAfter: recentThreshold().toISOString(),
      others: DEMO_PRESENCE,
    };
  }

  const user = await getCoupleUser();
  if (!user) {
    return {
      currentUserId: null,
      onlineAfter: onlineThreshold().toISOString(),
      recentAfter: recentThreshold().toISOString(),
      others: [],
    };
  }

  const db = getDatabase();
  const rows = await db
    .select({ presence: presenceState, profile: profiles })
    .from(presenceState)
    .leftJoin(profiles, eq(presenceState.userId, profiles.id))
    .where(ne(presenceState.userId, user.id))
    .orderBy(desc(presenceState.lastSeenAt));

  return {
    currentUserId: user.id,
    onlineAfter: onlineThreshold().toISOString(),
    recentAfter: recentThreshold().toISOString(),
    others: rows.map((row) => mapPresence(row.presence, row.profile)),
  };
}

export async function updatePresence(input: {
  currentPath?: unknown;
  pageTitle?: unknown;
}) {
  if (!isLiveMode()) return getPresenceSummary();

  const user = await getCoupleUser();
  if (!user) throw new Error("请先登录。");

  const db = getDatabase();
  const now = new Date();
  const currentPath = normalizePath(input.currentPath);
  const pageTitle = cleanText(input.pageTitle, 140) || null;

  await db
    .insert(presenceState)
    .values({
      userId: user.id,
      currentPath,
      pageTitle,
      lastSeenAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: presenceState.userId,
      set: {
        currentPath,
        pageTitle,
        lastSeenAt: now,
        updatedAt: now,
      },
    });

  const [partner] = await db
    .select()
    .from(presenceState)
    .where(and(ne(presenceState.userId, user.id), eq(presenceState.currentPath, currentPath)))
    .limit(1);

  if (partner && partner.lastSeenAt.getTime() >= Date.now() - ONLINE_MS) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [existing] = await db
      .select({ id: footprintEvents.id })
      .from(footprintEvents)
      .where(
        and(
          eq(footprintEvents.eventType, "co_presence"),
          eq(footprintEvents.pagePath, currentPath),
          gte(footprintEvents.createdAt, tenMinutesAgo),
        ),
      )
      .limit(1);

    if (!existing) {
      const [created] = await db
        .insert(footprintEvents)
        .values({
          authorId: user.id,
          eventType: "co_presence",
          scope: "page",
          pagePath: currentPath,
          pageTitle,
          body: "你们刚才一起停在这里。",
        })
        .returning();
      await createActivityEvent({
        actorId: user.id,
        kind: "co_presence",
        sourceType: "footprint_event",
        sourceId: created.id,
        pagePath: currentPath,
        pageTitle,
        body: created.body,
        createdAt: created.createdAt,
      }).catch(() => undefined);
    }
  }

  return getPresenceSummary();
}

export async function getFootprints({
  pagePath,
  includeInstant = false,
  targetType,
  targetId,
  excludeTargetType,
  failSoft = false,
  limit = 40,
}: {
  pagePath?: string;
  includeInstant?: boolean;
  targetType?: string;
  targetId?: string;
  excludeTargetType?: string;
  failSoft?: boolean;
  limit?: number;
} = {}) {
  if (!isLiveMode()) {
    const filtered = pagePath
      ? DEMO_FOOTPRINTS.filter((item) => item.page_path === pagePath)
      : DEMO_FOOTPRINTS;
    return filtered.slice(0, limit);
  }

  const user = await getCoupleUser();
  if (!user) return [];

  const db = getDatabase();
  const normalizedPath = pagePath ? normalizePath(pagePath) : undefined;
  const clauses: SQL[] = [];
  if (normalizedPath) clauses.push(eq(footprintEvents.pagePath, normalizedPath));
  if (targetType) clauses.push(eq(footprintEvents.targetType, targetType));
  if (targetId) clauses.push(eq(footprintEvents.targetId, targetId));
  if (!targetType) {
    clauses.push(or(isNull(footprintEvents.targetType), ne(footprintEvents.targetType, "follow_up"))!);
  }
  if (excludeTargetType) {
    clauses.push(or(isNull(footprintEvents.targetType), ne(footprintEvents.targetType, excludeTargetType))!);
  }
  if (!includeInstant) {
    clauses.push(or(ne(footprintEvents.eventType, "message"), ne(footprintEvents.scope, "site"))!);
  }

  let rows: { event: FootprintRow; profile: typeof profiles.$inferSelect | null }[];
  try {
    rows = await db
      .select({ event: footprintEvents, profile: profiles })
      .from(footprintEvents)
      .leftJoin(profiles, eq(footprintEvents.authorId, profiles.id))
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(footprintEvents.createdAt))
      .limit(Math.max(1, Math.min(limit, 80)));
  } catch (error) {
    if (failSoft) return [];
    throw error;
  }

  return rows.map((row) => mapFootprint(row.event, row.profile));
}

export async function createFootprint(input: {
  eventType?: unknown;
  scope?: unknown;
  pagePath?: unknown;
  pageTitle?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  body?: unknown;
  reaction?: unknown;
}) {
  if (!isLiveMode()) {
    return DEMO_FOOTPRINTS[0] ?? null;
  }

  const user = await getCoupleUser();
  if (!user) throw new Error("请先登录。");

  const eventType = normalizeEventType(input.eventType);
  const scope = normalizeScope(input.scope);
  const pagePath = normalizePath(input.pagePath);
  const pageTitle = cleanText(input.pageTitle, 140) || null;
  const targetType = cleanText(input.targetType, 40) || null;
  const targetId = cleanText(input.targetId, 120) || null;
  const body = cleanText(input.body, 500) || null;
  const reaction = cleanText(input.reaction, 24) || null;

  if (eventType === "message" && !body) throw new Error("先写一句想留下的话。");
  if (eventType === "reaction" && !reaction) throw new Error("请选择一个反应。");
  if (targetType === "follow_up") {
    throw new Error("追评已经迁移到独立接口，请刷新页面后重试。");
  }

  const db = getDatabase();
  const [created] = await db
    .insert(footprintEvents)
    .values({
      authorId: user.id,
      eventType,
      scope,
      pagePath,
      pageTitle,
      targetType,
      targetId,
      body,
      reaction,
    })
    .returning();

  await createActivityEvent({
    actorId: user.id,
    kind: eventType === "message" ? "page_message" : eventType,
    sourceType: "footprint_event",
    sourceId: created.id,
    entryId: targetType === "entry" ? targetId : null,
    pagePath,
    pageTitle,
    body,
    reaction,
    createdAt: created.createdAt,
  }).catch(() => undefined);

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  return mapFootprint(created, profile ?? null);
}
