import "server-only";

import { count, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode, isR2Configured } from "@/lib/config/backend";
import { getDatabase } from "@/lib/db/client";
import {
  entries as entriesTable,
  chatMessageMedia,
  chatMessages,
  memoryChapters,
  media as mediaTable,
  places,
  profiles,
  relationship as relationshipTable,
} from "@/lib/db/schema";
import type {
  Entry,
  EntryCategory,
  Media,
  MediaType,
  Relationship,
} from "@/lib/database.types";
import { createPrivateReadUrl } from "@/lib/r2/client";
import { DEMO_ENTRIES, DEMO_RELATIONSHIP } from "./demo";

function toIso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function senderRole(value: string): "self" | "partner" | "system" {
  return value === "self" || value === "partner" ? value : "system";
}

async function mapMedia(
  rows: (typeof mediaTable.$inferSelect)[],
): Promise<Media[]> {
  return Promise.all(
    rows.map(async (item) => ({
      id: item.id,
      entry_id: item.entryId,
      r2_key: item.r2Key,
      thumbnail_r2_key: item.thumbnailR2Key,
      mime: item.mime,
      type: item.type as MediaType,
      caption: item.caption,
      sort_order: item.sortOrder,
      captured_at: toIso(item.capturedAt),
      width: item.width,
      height: item.height,
      duration_ms: item.durationMs,
      sha256: item.sha256,
      lat: item.lat,
      lng: item.lng,
      created_at: item.createdAt.toISOString(),
      display_url: isR2Configured()
        ? await createPrivateReadUrl(item.r2Key)
        : undefined,
    })),
  );
}

async function getLiveTimeline(): Promise<Entry[]> {
  const db = getDatabase();
  const authorProfiles = alias(profiles, "author_profiles");
  const editorProfiles = alias(profiles, "editor_profiles");
  const rows = await db
    .select({
      entry: entriesTable,
      authorProfile: authorProfiles,
      editorProfile: editorProfiles,
    })
    .from(entriesTable)
    .leftJoin(authorProfiles, eq(entriesTable.authorId, authorProfiles.id))
    .leftJoin(editorProfiles, eq(entriesTable.updatedBy, editorProfiles.id))
    .orderBy(desc(entriesTable.happenedAt));

  const entryIds = rows.map(({ entry }) => entry.id);
  const mediaRows = entryIds.length
    ? await db
        .select()
        .from(mediaTable)
        .where(inArray(mediaTable.entryId, entryIds))
        .orderBy(mediaTable.sortOrder)
    : [];

  const mediaByEntry = new Map<string, typeof mediaRows>();
  for (const item of mediaRows) {
    const list = mediaByEntry.get(item.entryId) ?? [];
    list.push(item);
    mediaByEntry.set(item.entryId, list);
  }

  return Promise.all(
    rows.map(async ({ entry, authorProfile, editorProfile }) => ({
      id: entry.id,
      author_id: entry.authorId,
      updated_by: entry.updatedBy,
      chapter_id: entry.chapterId,
      category: entry.category as EntryCategory,
      title: entry.title,
      body: entry.body,
      happened_at: entry.happenedAt.toISOString(),
      happened_precision: entry.happenedPrecision,
      place_id: entry.placeId,
      mood: entry.mood,
      weather: entry.weather,
      rating: entry.rating,
      source: entry.source,
      source_ref: entry.sourceRef,
      is_highlight: entry.isHighlight,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString(),
      media: await mapMedia(mediaByEntry.get(entry.id) ?? []),
      profiles: authorProfile
        ? {
            display_name: authorProfile.displayName,
            avatar_url: authorProfile.avatarUrl,
            color: authorProfile.color,
          }
        : null,
      updated_by_profile: editorProfile
        ? {
            display_name: editorProfile.displayName,
            avatar_url: editorProfile.avatarUrl,
            color: editorProfile.color,
          }
        : null,
    })),
  );
}

export async function getTimelineData() {
  if (!isLiveMode()) {
    return {
      entries: DEMO_ENTRIES,
      userId: undefined,
      isDemo: true,
    };
  }

  const [entries, user] = await Promise.all([
    getLiveTimeline(),
    getCoupleUser(),
  ]);
  return {
    entries,
    userId: user?.id,
    isDemo: false,
  };
}

export async function getEntriesData(categories: EntryCategory[]) {
  const result = await getTimelineData();
  return {
    ...result,
    entries: result.entries.filter((entry) =>
      categories.includes(entry.category),
    ),
  };
}

export async function getMemoryDetail(id: string) {
  if (!isLiveMode()) {
    const entry = DEMO_ENTRIES.find((item) => item.id === id) ?? null;
    return {
      entry,
      chapter: null,
      place: null,
      messages: [],
      isDemo: true,
    };
  }

  const db = getDatabase();
  const timeline = await getLiveTimeline();
  const entry = timeline.find((item) => item.id === id) ?? null;
  if (!entry) return null;
  const [chapterRows, placeRows, messages] = await Promise.all([
    entry.chapter_id
      ? db
          .select()
          .from(memoryChapters)
          .where(eq(memoryChapters.id, entry.chapter_id))
          .limit(1)
      : Promise.resolve([]),
    entry.place_id
      ? db.select().from(places).where(eq(places.id, entry.place_id)).limit(1)
      : Promise.resolve([]),
    db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.entryId, id))
      .orderBy(chatMessages.sequence),
  ]);
  const messageIds = messages.map((message) => message.id);
  const messageMediaRows = messageIds.length
    ? await db
        .select({
          messageId: chatMessageMedia.messageId,
          media: mediaTable,
        })
        .from(chatMessageMedia)
        .innerJoin(mediaTable, eq(chatMessageMedia.mediaId, mediaTable.id))
        .where(inArray(chatMessageMedia.messageId, messageIds))
    : [];
  const resolvedMessageMedia = await mapMedia(
    messageMediaRows.map((row) => row.media),
  );
  const mediaByMessage = new Map<string, typeof resolvedMessageMedia>();
  messageMediaRows.forEach((row, index) => {
    const list = mediaByMessage.get(row.messageId) ?? [];
    list.push(resolvedMessageMedia[index]);
    mediaByMessage.set(row.messageId, list);
  });
  return {
    entry,
    chapter: chapterRows[0] ?? null,
    place: placeRows[0] ?? null,
    messages: messages.map((message) => ({
      id: message.id,
      senderRole: senderRole(message.senderRole),
      senderDisplayName:
        message.senderRole === "self"
          ? process.env.REVIEW_SELF_LABEL || "我"
          : message.senderRole === "partner"
            ? process.env.REVIEW_PARTNER_LABEL || "她"
            : "系统",
      renderType: message.renderType,
      content: message.content,
      sentAt: message.sentAt.toISOString(),
      quote:
        message.quoteTitle || message.quoteContent
          ? {
              title: message.quoteTitle,
              content: message.quoteContent,
            }
          : null,
      media: (mediaByMessage.get(message.id) ?? []).map((item) => ({
        kind: item.type,
        url: item.display_url,
        label: item.caption ?? item.mime ?? item.type,
      })),
    })),
    isDemo: false,
  };
}

export async function getMapPoints(foodOnly = false) {
  if (!isLiveMode()) {
    return [
      {
        id: "demo-1",
        title: "抵达西北的第一天",
        happenedAt: "2026-04-04T07:25:31.000Z",
        latitude: 36.62,
        longitude: 101.78,
        category: "trip" as EntryCategory,
        placeName: "西宁",
        chapterId: "demo-trip",
        coverUrl: null,
      },
      {
        id: "demo-food",
        title: "找到一家会再去的小店",
        happenedAt: new Date().toISOString(),
        latitude: 31.23,
        longitude: 121.47,
        category: "food" as EntryCategory,
        placeName: "街角小店",
        chapterId: null,
        coverUrl: null,
      },
      {
        id: "demo-milestone",
        title: "湖边看到整片倒影",
        happenedAt: "2026-04-07T06:30:00.000Z",
        latitude: 36.9,
        longitude: 100.2,
        category: "trip" as EntryCategory,
        placeName: "湖边",
        chapterId: "demo-trip",
        coverUrl: null,
      },
    ].filter((point) => !foodOnly || point.category === "food");
  }

  const db = getDatabase();
  const rows = await db
    .select({
      id: entriesTable.id,
      title: entriesTable.title,
      happenedAt: entriesTable.happenedAt,
      category: entriesTable.category,
      chapterId: entriesTable.chapterId,
      latitude: places.lat,
      longitude: places.lng,
      placeName: places.name,
    })
    .from(entriesTable)
    .innerJoin(places, eq(entriesTable.placeId, places.id))
    .orderBy(entriesTable.happenedAt);
  return rows
    .filter(
      (row) =>
        row.latitude != null &&
        row.longitude != null &&
        (!foodOnly ||
          row.category === "food"),
    )
    .map((row) => ({
      id: row.id,
      title: row.title ?? "无题回忆",
      happenedAt: row.happenedAt.toISOString(),
      latitude: row.latitude!,
      longitude: row.longitude!,
      category: row.category as EntryCategory,
      placeName: row.placeName,
      chapterId: row.chapterId,
      coverUrl: null,
    }));
}

export async function getHomeData() {
  if (!isLiveMode()) {
    const counts = Object.fromEntries(
      DEMO_ENTRIES.map((entry) => entry.category).map((category) => [
        category,
        DEMO_ENTRIES.filter((entry) => entry.category === category).length,
      ]),
    );
    return {
      relationship: DEMO_RELATIONSHIP,
      latest: DEMO_ENTRIES[0],
      count: 37,
      counts,
      isDemo: true,
    };
  }

  const db = getDatabase();
  const [relationshipRows, countRows, timeline] = await Promise.all([
    db
      .select()
      .from(relationshipTable)
      .where(eq(relationshipTable.id, 1))
      .limit(1),
    db.select({ value: count() }).from(entriesTable),
    getLiveTimeline(),
  ]);

  const item = relationshipRows[0];
  const relationship: Relationship = item
    ? {
        id: item.id,
        title: item.title,
        together_since: item.togetherSince,
        first_met_on: item.firstMetOn,
        partner_a: item.partnerA,
        partner_b: item.partnerB,
        updated_at: item.updatedAt.toISOString(),
      }
    : DEMO_RELATIONSHIP;

  return {
    relationship,
    latest: timeline[0] ?? null,
    count: countRows[0]?.value ?? 0,
    counts: Object.fromEntries(
      timeline.map((entry) => entry.category).map((category) => [
        category,
        timeline.filter((entry) => entry.category === category).length,
      ]),
    ),
    isDemo: false,
  };
}
