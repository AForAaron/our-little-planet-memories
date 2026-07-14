import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  lt,
  or,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";
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
} from "@/lib/db/schema";
import type {
  Entry,
  EntryCategory,
  Media,
  MediaType,
} from "@/lib/database.types";
import { createPrivateReadUrl } from "@/lib/r2/client";
import { DEMO_ENTRIES, DEMO_RELATIONSHIP } from "./demo";
import { getSiteSettings } from "./settings";

export const DEFAULT_ENTRY_PAGE_SIZE = 24;
const MAX_ENTRY_PAGE_SIZE = 100;
/** Keep the server-rendered map payload finite even as the archive grows. */
export const MAP_INITIAL_POINT_LIMIT = 120;
/** A viewport has more visual room than the initial payload, but is still capped. */
export const MAP_VIEWPORT_POINT_LIMIT = 180;

export type MapPointBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

type MapPointOptions = {
  bbox?: MapPointBounds | null;
  limit?: number;
};

type MapPoint = {
  id: string;
  title: string;
  happenedAt: string;
  latitude: number;
  longitude: number;
  category: EntryCategory;
  placeName: string | null;
  chapterId: string | null;
  coverUrl: string | null;
};

export type MapPointsPage = {
  points: MapPoint[];
  /** True when the query was capped and a closer viewport can load more. */
  hasMore: boolean;
};

type EntryCursor = {
  happenedAt: string;
  id: string;
};

type EntriesPageOptions = {
  categories?: EntryCategory[];
  cursor?: string | null;
  limit?: number;
};

export type EntriesPage = {
  items: Entry[];
  nextCursor: string | null;
  total: number;
};

function toIso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function senderRole(value: string): "self" | "partner" | "system" {
  return value === "self" || value === "partner" ? value : "system";
}

function normalizeLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_ENTRY_PAGE_SIZE;
  return Math.min(MAX_ENTRY_PAGE_SIZE, Math.max(1, Math.floor(value!)));
}

function normalizeCategories(categories: EntryCategory[] | undefined) {
  return Array.from(new Set(categories ?? []));
}

function encodeEntryCursor(entry: Pick<Entry, "id" | "happened_at">) {
  return Buffer.from(
    JSON.stringify({ happenedAt: entry.happened_at, id: entry.id }),
  ).toString("base64url");
}

function decodeEntryCursor(value: string | null | undefined): EntryCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<EntryCursor>;
    const date = new Date(parsed.happenedAt ?? "");
    if (
      !parsed.id ||
      typeof parsed.id !== "string" ||
      parsed.id.length > 128 ||
      Number.isNaN(date.getTime())
    ) {
      throw new Error("invalid cursor");
    }
    return { happenedAt: date.toISOString(), id: parsed.id };
  } catch {
    throw new Error("分页游标无效，请从第一页重新加载。");
  }
}

function createReadUrlResolver() {
  const urls = new Map<string, Promise<string | undefined>>();
  return (key: string | null | undefined) => {
    if (!key || !isR2Configured()) return Promise.resolve(undefined);
    const existing = urls.get(key);
    if (existing) return existing;
    const next = createPrivateReadUrl(key);
    urls.set(key, next);
    return next;
  };
}

/**
 * List views deliberately resolve image thumbnails as `display_url` so their
 * existing consumers do not accidentally load original-size private objects.
 * Detail views resolve only the original; `thumbnail_url` is intentionally a
 * list/map field so detail rendering does not sign two URLs per asset.
 */
async function mapMedia(
  rows: (typeof mediaTable.$inferSelect)[],
  mode: "list" | "detail" = "detail",
): Promise<Media[]> {
  const readUrl = createReadUrlResolver();

  return Promise.all(
    rows.map(async (item) => {
      const thumbnailKey =
        item.thumbnailR2Key ?? (item.type === "image" ? item.r2Key : null);
      const displayKey =
        mode === "list" && item.type === "image"
          ? thumbnailKey
          : item.r2Key;
      const displayUrl = await readUrl(displayKey);
      // Detail pages deliberately sign only originals. Thumbnail URLs are a
      // list/map optimization, and signing both variants per detail asset
      // would otherwise add an unnecessary R2 presigning hot path.
      const thumbnailUrl =
        mode === "list" ? await readUrl(thumbnailKey) : undefined;

      return {
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
        // `display_url` remains for the current UI. In list mode it is the
        // thumbnail for images and a compatibility fallback for legacy media.
        display_url: displayUrl,
        thumbnail_url: thumbnailUrl,
      } satisfies Media;
    }),
  );
}

function toEntry(
  row: {
    entry: typeof entriesTable.$inferSelect;
    authorProfile: typeof profiles.$inferSelect | null;
    editorProfile: typeof profiles.$inferSelect | null;
  },
  media: Media[],
  mediaCount?: number,
): Entry {
  const { entry, authorProfile, editorProfile } = row;
  return {
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
    media,
    media_count: mediaCount,
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
  };
}

async function getLiveEntriesPage({
  categories,
  cursor,
  limit,
}: {
  categories: EntryCategory[];
  cursor: EntryCursor | null;
  limit: number;
}): Promise<EntriesPage> {
  const db = getDatabase();
  const authorProfiles = alias(profiles, "author_profiles");
  const editorProfiles = alias(profiles, "editor_profiles");
  const filters = [];

  if (categories.length) {
    filters.push(inArray(entriesTable.category, categories));
  }
  if (cursor) {
    const cursorDate = new Date(cursor.happenedAt);
    filters.push(
      or(
        lt(entriesTable.happenedAt, cursorDate),
        and(
          eq(entriesTable.happenedAt, cursorDate),
          lt(entriesTable.id, cursor.id),
        ),
      ),
    );
  }
  const where = filters.length ? and(...filters) : undefined;

  const [rowsWithExtra, totalRows] = await Promise.all([
    db
      .select({
        entry: entriesTable,
        authorProfile: authorProfiles,
        editorProfile: editorProfiles,
      })
      .from(entriesTable)
      .leftJoin(authorProfiles, eq(entriesTable.authorId, authorProfiles.id))
      .leftJoin(editorProfiles, eq(entriesTable.updatedBy, editorProfiles.id))
      .where(where)
      .orderBy(desc(entriesTable.happenedAt), desc(entriesTable.id))
      .limit(limit + 1),
    db.select({ value: count() }).from(entriesTable).where(
      categories.length ? inArray(entriesTable.category, categories) : undefined,
    ),
  ]);

  const hasMore = rowsWithExtra.length > limit;
  const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;
  const entryIds = rows.map(({ entry }) => entry.id);
  const [coverMediaRows, mediaCountRows] = entryIds.length
    ? await Promise.all([
        db
          .selectDistinctOn([mediaTable.entryId])
          .from(mediaTable)
          .where(inArray(mediaTable.entryId, entryIds))
          .orderBy(mediaTable.entryId, mediaTable.sortOrder, mediaTable.id),
        db
          .select({ entryId: mediaTable.entryId, value: count() })
          .from(mediaTable)
          .where(inArray(mediaTable.entryId, entryIds))
          .groupBy(mediaTable.entryId),
      ])
    : [[], []];
  const mappedMedia = await mapMedia(coverMediaRows, "list");
  const mediaByEntry = new Map<string, Media[]>();
  for (const item of mappedMedia) {
    const list = mediaByEntry.get(item.entry_id) ?? [];
    list.push(item);
    mediaByEntry.set(item.entry_id, list);
  }
  const mediaCountByEntry = new Map(
    mediaCountRows.map((row) => [row.entryId, row.value]),
  );
  const items = rows.map((row) =>
    toEntry(
      row,
      mediaByEntry.get(row.entry.id) ?? [],
      mediaCountByEntry.get(row.entry.id) ?? 0,
    ),
  );

  return {
    items,
    nextCursor:
      hasMore && items.length ? encodeEntryCursor(items[items.length - 1]) : null,
    total: totalRows[0]?.value ?? 0,
  };
}

/**
 * Resolves the same deliberately small projection used by timeline cards after
 * a mutation. Keeping this separate from the detail reader means an edit can
 * update the visible card (including a newly uploaded cover and media count)
 * without fetching every attachment or triggering a route refresh.
 */
async function getLiveEntryListItem(id: string): Promise<Entry | null> {
  const db = getDatabase();
  const authorProfiles = alias(profiles, "entry_list_author_profiles");
  const editorProfiles = alias(profiles, "entry_list_editor_profiles");
  const rows = await db
    .select({
      entry: entriesTable,
      authorProfile: authorProfiles,
      editorProfile: editorProfiles,
    })
    .from(entriesTable)
    .leftJoin(authorProfiles, eq(entriesTable.authorId, authorProfiles.id))
    .leftJoin(editorProfiles, eq(entriesTable.updatedBy, editorProfiles.id))
    .where(eq(entriesTable.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [coverMediaRows, mediaCountRows] = await Promise.all([
    db
      .selectDistinctOn([mediaTable.entryId])
      .from(mediaTable)
      .where(eq(mediaTable.entryId, id))
      .orderBy(mediaTable.entryId, mediaTable.sortOrder, mediaTable.id)
      .limit(1),
    db
      .select({ value: count() })
      .from(mediaTable)
      .where(eq(mediaTable.entryId, id)),
  ]);

  return toEntry(
    row,
    await mapMedia(coverMediaRows, "list"),
    mediaCountRows[0]?.value ?? 0,
  );
}

function entryComesAfterCursor(entry: Entry, cursor: EntryCursor) {
  const entryTime = new Date(entry.happened_at).getTime();
  const cursorTime = new Date(cursor.happenedAt).getTime();
  return (
    entryTime < cursorTime ||
    (entryTime === cursorTime && entry.id < cursor.id)
  );
}

function getDemoEntriesPage({
  categories,
  cursor,
  limit,
}: {
  categories: EntryCategory[];
  cursor: EntryCursor | null;
  limit: number;
}): EntriesPage {
  const matching = DEMO_ENTRIES.filter(
    (entry) => !categories.length || categories.includes(entry.category),
  )
    .slice()
    .sort(
      (left, right) =>
        new Date(right.happened_at).getTime() -
          new Date(left.happened_at).getTime() ||
        right.id.localeCompare(left.id),
    );
  const remaining = cursor
    ? matching.filter((entry) => entryComesAfterCursor(entry, cursor))
    : matching;
  const hasMore = remaining.length > limit;
  const items = remaining.slice(0, limit);
  return {
    items,
    nextCursor:
      hasMore && items.length ? encodeEntryCursor(items[items.length - 1]) : null,
    total: matching.length,
  };
}

/**
 * Reads only one cursor-sized page and the media attached to that page. This
 * is the shared server-side source for route rendering and /api/entries.
 */
export async function getEntriesPage(
  options: EntriesPageOptions = {},
): Promise<EntriesPage> {
  const categories = normalizeCategories(options.categories);
  const cursor = decodeEntryCursor(options.cursor);
  const limit = normalizeLimit(options.limit);
  if (!isLiveMode()) {
    return getDemoEntriesPage({ categories, cursor, limit });
  }
  return getLiveEntriesPage({ categories, cursor, limit });
}

/**
 * Return one list-card projection for local optimistic reconciliation after an
 * edit. The URL remains a short-lived private R2 URL; it is never persisted.
 */
export async function getEntryListItem(id: string): Promise<Entry | null> {
  if (!isLiveMode()) {
    return DEMO_ENTRIES.find((entry) => entry.id === id) ?? null;
  }
  return getLiveEntryListItem(id);
}

export async function getTimelineData(options: EntriesPageOptions = {}) {
  const [page, user] = await Promise.all([
    getEntriesPage(options),
    isLiveMode() ? getCoupleUser() : Promise.resolve(null),
  ]);
  return {
    ...page,
    // Keep the existing rendering contract while exposing pagination state for
    // TimelineView's incremental loader.
    entries: page.items,
    userId: user?.id,
    isDemo: !isLiveMode(),
  };
}

export async function getEntriesData(
  categories: EntryCategory[],
  options: Omit<EntriesPageOptions, "categories"> = {},
) {
  return getTimelineData({ ...options, categories });
}

async function getLiveMemoryDetail(id: string) {
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
    .where(eq(entriesTable.id, id))
    .limit(1);
  const entryRow = rows[0];
  if (!entryRow) return null;

  const [mediaRows, chapterRows, placeRows, messages] = await Promise.all([
    db
      .select()
      .from(mediaTable)
      .where(eq(mediaTable.entryId, id))
      .orderBy(mediaTable.sortOrder),
    entryRow.entry.chapterId
      ? db
          .select()
          .from(memoryChapters)
          .where(eq(memoryChapters.id, entryRow.entry.chapterId))
          .limit(1)
      : Promise.resolve([]),
    entryRow.entry.placeId
      ? db.select().from(places).where(eq(places.id, entryRow.entry.placeId)).limit(1)
      : Promise.resolve([]),
    db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.entryId, id))
      .orderBy(chatMessages.sequence),
  ]);
  const entry = toEntry(entryRow, await mapMedia(mediaRows, "detail"));
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
        .orderBy(chatMessageMedia.messageId, mediaTable.sortOrder)
    : [];
  const resolvedMessageMedia = await mapMedia(
    messageMediaRows.map((row) => row.media),
    "detail",
  );
  const mediaByMessage = new Map<string, Media[]>();
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

// Next invokes generateMetadata and the page render independently. React's
// request cache lets both calls share the same detail query and signed URLs.
export const getMemoryDetail = cache(async (id: string) => {
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
  return getLiveMemoryDetail(id);
});

function normalizeMapPointLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return MAP_INITIAL_POINT_LIMIT;
  return Math.min(
    MAP_VIEWPORT_POINT_LIMIT,
    Math.max(1, Math.floor(value ?? MAP_INITIAL_POINT_LIMIT)),
  );
}

function normalizeLongitude(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function normalizeMapBounds(bounds: MapPointBounds | null | undefined) {
  if (
    !bounds ||
    !Number.isFinite(bounds.south) ||
    !Number.isFinite(bounds.west) ||
    !Number.isFinite(bounds.north) ||
    !Number.isFinite(bounds.east)
  ) {
    return null;
  }

  const south = Math.max(-90, Math.min(90, Math.min(bounds.south, bounds.north)));
  const north = Math.max(-90, Math.min(90, Math.max(bounds.south, bounds.north)));
  // A whole-world view must not turn into a tiny anti-meridian slice after
  // longitude normalization.
  if (Math.abs(bounds.east - bounds.west) >= 359.999) {
    return { south, west: -180, north, east: 180 } satisfies MapPointBounds;
  }

  return {
    south,
    west: normalizeLongitude(bounds.west),
    north,
    east: normalizeLongitude(bounds.east),
  } satisfies MapPointBounds;
}

function pointIsInsideBounds(point: MapPoint, bounds: MapPointBounds | null) {
  if (!bounds) return true;
  if (point.latitude < bounds.south || point.latitude > bounds.north) return false;
  return bounds.west <= bounds.east
    ? point.longitude >= bounds.west && point.longitude <= bounds.east
    : point.longitude >= bounds.west || point.longitude <= bounds.east;
}

/**
 * Produces a finite map payload. Initial page renders use 120 points; the
 * authenticated viewport endpoint passes a bbox so it never signs every
 * historical cover image as the collection grows.
 */
export async function getMapPoints(
  foodOnly = false,
  options: MapPointOptions = {},
): Promise<MapPointsPage> {
  const limit = normalizeMapPointLimit(options.limit);
  const bounds = normalizeMapBounds(options.bbox);

  if (!isLiveMode()) {
    const demoCandidates = [
      {
        id: "demo-1",
        title: "抵达西北的第一天",
        happenedAt: "2026-04-04T07:25:31.000Z",
        latitude: 36.62,
        longitude: 101.78,
        category: "trip",
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
        category: "food",
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
        category: "trip",
        placeName: "湖边",
        chapterId: "demo-trip",
        coverUrl: null,
      },
    ] satisfies MapPoint[];
    const demoPoints = demoCandidates.filter(
      (point) =>
        (!foodOnly || point.category === "food") &&
        pointIsInsideBounds(point, bounds),
    );
    return {
      points: demoPoints.slice(0, limit),
      hasMore: demoPoints.length > limit,
    };
  }

  const db = getDatabase();
  const filters = [
    isNotNull(places.lat),
    isNotNull(places.lng),
    gte(places.lat, -90),
    lte(places.lat, 90),
    gte(places.lng, -180),
    lte(places.lng, 180),
  ];
  if (foodOnly) filters.push(eq(entriesTable.category, "food"));
  if (bounds) {
    filters.push(gte(places.lat, bounds.south), lte(places.lat, bounds.north));
    filters.push(
      (bounds.west <= bounds.east
        ? and(gte(places.lng, bounds.west), lte(places.lng, bounds.east))
        : or(gte(places.lng, bounds.west), lte(places.lng, bounds.east)))!,
    );
  }

  const rowsWithExtra = await db
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
    .where(and(...filters))
    .orderBy(desc(entriesTable.happenedAt), desc(entriesTable.id))
    .limit(limit + 1);
  const hasMore = rowsWithExtra.length > limit;
  const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;
  const entryIds = rows.map((row) => row.id);
  // DISTINCT ON picks the actual first attachment even for older rows that
  // contain duplicate sort orders from a past edit flow.
  const coverMediaRows = entryIds.length
    ? await db
        .selectDistinctOn([mediaTable.entryId])
        .from(mediaTable)
        .where(
          and(
            inArray(mediaTable.entryId, entryIds),
            eq(mediaTable.type, "image"),
          ),
        )
        .orderBy(mediaTable.entryId, mediaTable.sortOrder, mediaTable.id)
    : [];
  const coverMediaByEntry = new Map(
    coverMediaRows.map((item) => [item.entryId, item]),
  );
  const readUrl = createReadUrlResolver();
  const points = await Promise.all(
    rows.map(async (row) => {
      const cover = coverMediaByEntry.get(row.id);
      return {
        id: row.id,
        title: row.title ?? "无题回忆",
        happenedAt: row.happenedAt.toISOString(),
        latitude: row.latitude!,
        longitude: row.longitude!,
        category: row.category as EntryCategory,
        placeName: row.placeName,
        chapterId: row.chapterId,
        // R2 remains private: this is a short-lived signed 640px thumbnail
        // when available, with a safe legacy-original fallback.
        coverUrl:
          (await readUrl(cover?.thumbnailR2Key ?? cover?.r2Key)) ?? null,
      } satisfies MapPoint;
    }),
  );
  return { points, hasMore };
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
  const authorProfiles = alias(profiles, "home_author_profiles");
  const editorProfiles = alias(profiles, "home_editor_profiles");
  const [settings, countRows, countByCategoryRows, latestRows] =
    await Promise.all([
      // ProtectedLayout already requests this cached value for the header.
      // Reusing it avoids a second relationship/profile round-trip on home.
      getSiteSettings(),
      db.select({ value: count() }).from(entriesTable),
      db
        .select({ category: entriesTable.category, value: count() })
        .from(entriesTable)
        .groupBy(entriesTable.category),
      db
        .select({
          entry: entriesTable,
          authorProfile: authorProfiles,
          editorProfile: editorProfiles,
        })
        .from(entriesTable)
        .leftJoin(authorProfiles, eq(entriesTable.authorId, authorProfiles.id))
        .leftJoin(editorProfiles, eq(entriesTable.updatedBy, editorProfiles.id))
        .orderBy(desc(entriesTable.happenedAt), desc(entriesTable.id))
        .limit(1),
    ]);
  const latestRow = latestRows[0];
  const latestMediaRows = latestRow
    ? await db
        .select()
        .from(mediaTable)
        // Home uses only a still-image cover. Do not sign a video/audio URL
        // and accidentally render it through an <img> tag.
        .where(
          and(
            eq(mediaTable.entryId, latestRow.entry.id),
            eq(mediaTable.type, "image"),
          ),
        )
        .orderBy(mediaTable.sortOrder)
        .limit(1)
    : [];
  const latest = latestRow
    ? toEntry(latestRow, await mapMedia(latestMediaRows, "list"))
    : null;

  return {
    relationship: settings.relationship,
    latest,
    count: countRows[0]?.value ?? 0,
    counts: Object.fromEntries(
      countByCategoryRows.map((row) => [row.category, row.value]),
    ),
    isDemo: false,
  };
}
