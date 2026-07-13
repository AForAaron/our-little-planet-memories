import "server-only";

import { and, count, desc, eq, isNull, ne } from "drizzle-orm";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import type {
  ActivityNotification,
  ActivityNotificationType,
} from "@/lib/database.types";
import { getDatabase } from "@/lib/db/client";
import {
  activityNotifications,
  profiles,
} from "@/lib/db/schema";
import { DEMO_NOTIFICATIONS } from "./demo";

type NotificationRow = typeof activityNotifications.$inferSelect;

function mapProfile(row: typeof profiles.$inferSelect | null) {
  return row
    ? {
        display_name: row.displayName,
        avatar_url: row.avatarUrl,
        color: row.color,
      }
    : null;
}

function mapNotification(
  row: NotificationRow,
  actor: typeof profiles.$inferSelect | null,
): ActivityNotification {
  return {
    id: row.id,
    recipient_id: row.recipientId,
    actor_id: row.actorId,
    type: row.type as ActivityNotificationType,
    entry_id: row.entryId,
    follow_up_id: row.followUpId,
    title: row.title,
    body: row.body,
    href: row.href,
    read_at: row.readAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    actor: mapProfile(actor),
  };
}

async function getPartnerProfileId(actorId: string) {
  const db = getDatabase();
  const [partner] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(ne(profiles.id, actorId))
    .limit(1);
  return partner?.id ?? null;
}

export async function createPartnerNotification(input: {
  actorId: string;
  type: ActivityNotificationType;
  entryId?: string | null;
  followUpId?: string | null;
  title: string;
  body?: string | null;
  href: string;
  recipientId?: string | null;
}) {
  if (!isLiveMode()) return null;
  const recipientId = input.recipientId ?? await getPartnerProfileId(input.actorId);
  if (!recipientId || recipientId === input.actorId) return null;

  const [created] = await getDatabase()
    .insert(activityNotifications)
    .values({
      recipientId,
      actorId: input.actorId,
      type: input.type,
      entryId: input.entryId ?? null,
      followUpId: input.followUpId ?? null,
      title: input.title,
      body: input.body ?? null,
      href: input.href,
    })
    .returning();
  return created;
}

export async function getNotifications(limit = 30) {
  if (!isLiveMode()) {
    return {
      unreadCount: DEMO_NOTIFICATIONS.filter((item) => !item.read_at).length,
      items: DEMO_NOTIFICATIONS.slice(0, limit),
    };
  }

  const user = await getCoupleUser();
  if (!user) return { unreadCount: 0, items: [] };

  const db = getDatabase();
  const [unread] = await db
    .select({ value: count() })
    .from(activityNotifications)
    .where(
      and(
        eq(activityNotifications.recipientId, user.id),
        isNull(activityNotifications.readAt),
      ),
    );
  const rows = await db
    .select({ notification: activityNotifications, actor: profiles })
    .from(activityNotifications)
    .leftJoin(profiles, eq(activityNotifications.actorId, profiles.id))
    .where(eq(activityNotifications.recipientId, user.id))
    .orderBy(desc(activityNotifications.createdAt))
    .limit(Math.max(1, Math.min(limit, 80)));

  return {
    unreadCount: unread?.value ?? 0,
    items: rows.map((row) => mapNotification(row.notification, row.actor)),
  };
}

export async function markNotificationsRead(input: {
  id?: unknown;
  all?: unknown;
}) {
  if (!isLiveMode()) return { ok: true };
  const user = await getCoupleUser();
  if (!user) throw new Error("请先登录。");

  const now = new Date();
  const id = typeof input.id === "string" ? input.id : "";
  if (input.all) {
    await getDatabase()
      .update(activityNotifications)
      .set({ readAt: now })
      .where(eq(activityNotifications.recipientId, user.id));
    return { ok: true };
  }
  if (!id) throw new Error("缺少通知 ID。");
  await getDatabase()
    .update(activityNotifications)
    .set({ readAt: now })
    .where(
      and(
        eq(activityNotifications.id, id),
        eq(activityNotifications.recipientId, user.id),
      ),
    );
  return { ok: true };
}
