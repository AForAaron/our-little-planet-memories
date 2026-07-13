import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  color: text("color"),
  theme: text("theme"),
  createdAt,
});

export const profileEmojiUsage = pgTable(
  "profile_emoji_usage",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    useCount: integer("use_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.profileId, table.emoji],
      name: "profile_emoji_usage_profile_id_emoji_pk",
    }),
    index("profile_emoji_usage_common_idx").on(
      table.profileId,
      table.useCount,
      table.lastUsedAt,
    ),
  ],
);

export const relationship = pgTable(
  "relationship",
  {
    id: integer("id").primaryKey().default(1),
    title: text("title"),
    togetherSince: date("together_since"),
    firstMetOn: date("first_met_on"),
    partnerA: uuid("partner_a").references(() => profiles.id),
    partnerB: uuid("partner_b").references(() => profiles.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("relationship_single_row", sql`${table.id} = 1`),
  ],
);

export const memoryChapters = pgTable("memory_chapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceRef: text("source_ref").unique(),
  kind: text("kind").notNull().default("day"),
  title: text("title").notNull(),
  summary: text("summary"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  createdAt,
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const places = pgTable("places", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category"),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  notes: text("notes"),
  privacyLevel: text("privacy_level").notNull().default("approximate"),
  precisionM: integer("precision_m").notNull().default(100),
  createdAt,
}, (table) => [
  check(
    "places_privacy_level_check",
    sql`${table.privacyLevel} in ('exact', 'approximate', 'private')`,
  ),
]);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id),
    updatedBy: uuid("updated_by").references(() => profiles.id),
    chapterId: uuid("chapter_id").references(() => memoryChapters.id),
    category: text("category").notNull(),
    title: text("title"),
    body: text("body"),
    happenedAt: timestamp("happened_at", { withTimezone: true }).notNull(),
    happenedPrecision: text("happened_precision").notNull().default("day"),
    placeId: uuid("place_id").references(() => places.id),
    mood: text("mood"),
    weather: text("weather"),
    rating: smallint("rating"),
    source: text("source").notNull().default("manual"),
    sourceRef: text("source_ref"),
    isHighlight: boolean("is_highlight").notNull().default(false),
    createdAt,
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("entries_happened_at_idx").on(table.happenedAt),
    index("entries_category_idx").on(table.category),
    uniqueIndex("entries_source_source_ref_unique")
      .on(table.source, table.sourceRef)
      .where(sql`${table.sourceRef} is not null`),
    check(
      "entries_category_check",
      sql`${table.category} in ('moment', 'diary', 'trip', 'first', 'milestone', 'anniversary', 'food', 'watch')`,
    ),
    check(
      "entries_rating_check",
      sql`${table.rating} is null or (${table.rating} between 1 and 5)`,
    ),
  ],
);

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    thumbnailR2Key: text("thumbnail_r2_key"),
    mime: text("mime"),
    type: text("type").notNull().default("image"),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    sha256: text("sha256"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    createdAt,
  },
  (table) => [
    check(
      "media_type_check",
      sql`${table.type} in ('image', 'video', 'audio')`,
    ),
  ],
);

export const wishlistItems = pgTable("wishlist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  isDone: boolean("is_done").notNull().default(false),
  doneAt: timestamp("done_at", { withTimezone: true }),
  doneEntryId: uuid("done_entry_id").references(() => entries.id),
  createdBy: uuid("created_by").references(() => profiles.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt,
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    senderRole: text("sender_role").notNull(),
    renderType: text("render_type").notNull(),
    content: text("content").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    sortSeq: bigint("sort_seq", { mode: "bigint" }).notNull(),
    replyToRef: text("reply_to_ref"),
    quoteTitle: text("quote_title"),
    quoteContent: text("quote_content"),
    sequence: integer("sequence").notNull().default(0),
  },
  (table) => [
    index("chat_messages_entry_sent_at_idx").on(
      table.entryId,
      table.sentAt,
    ),
    check(
      "chat_messages_sender_role_check",
      sql`${table.senderRole} in ('self', 'partner', 'system')`,
    ),
  ],
);

export const chatMessageMedia = pgTable(
  "chat_message_media",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.mediaId] }),
  ],
);

export const presenceState = pgTable("presence_state", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  currentPath: text("current_path").notNull(),
  pageTitle: text("page_title"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const footprintEvents = pgTable(
  "footprint_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    scope: text("scope").notNull().default("page"),
    pagePath: text("page_path").notNull(),
    pageTitle: text("page_title"),
    targetType: text("target_type"),
    targetId: text("target_id"),
    body: text("body"),
    reaction: text("reaction"),
    createdAt,
  },
  (table) => [
    index("footprint_events_created_at_idx").on(table.createdAt),
    index("footprint_events_page_path_idx").on(table.pagePath, table.createdAt),
    check(
      "footprint_events_event_type_check",
      sql`${table.eventType} in ('message', 'reaction', 'summon', 'co_presence', 'visit')`,
    ),
    check(
      "footprint_events_scope_check",
      sql`${table.scope} in ('site', 'page', 'entry', 'wishlist', 'place')`,
    ),
  ],
);

export const companionMessages = pgTable(
  "companion_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    pagePath: text("page_path"),
    pageTitle: text("page_title"),
    createdAt,
  },
  (table) => [
    index("companion_messages_created_at_idx").on(table.createdAt),
  ],
);

export const entryFollowUps = pgTable(
  "entry_follow_ups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    createdAt,
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("entry_follow_ups_entry_created_at_idx").on(
      table.entryId,
      table.createdAt,
    ),
    index("entry_follow_ups_parent_idx").on(table.parentId),
  ],
);

export const activityNotifications = pgTable(
  "activity_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    entryId: uuid("entry_id").references(() => entries.id, {
      onDelete: "cascade",
    }),
    followUpId: uuid("follow_up_id").references(() => entryFollowUps.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index("activity_notifications_recipient_created_at_idx").on(
      table.recipientId,
      table.createdAt,
    ),
    index("activity_notifications_unread_idx").on(
      table.recipientId,
      table.readAt,
    ),
    check(
      "activity_notifications_type_check",
      sql`${table.type} in ('entry_created', 'entry_updated', 'follow_up_created', 'follow_up_replied')`,
    ),
  ],
);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    entryId: uuid("entry_id").references(() => entries.id, {
      onDelete: "set null",
    }),
    pagePath: text("page_path"),
    pageTitle: text("page_title"),
    body: text("body"),
    reaction: text("reaction"),
    createdAt,
  },
  (table) => [
    index("activity_events_created_at_idx").on(table.createdAt),
    index("activity_events_entry_created_at_idx").on(
      table.entryId,
      table.createdAt,
    ),
    uniqueIndex("activity_events_source_unique").on(
      table.sourceType,
      table.sourceId,
    ),
    check(
      "activity_events_kind_check",
      sql`${table.kind} in ('companion_message', 'page_message', 'reaction', 'summon', 'co_presence', 'visit', 'follow_up_created', 'follow_up_replied', 'entry_created', 'entry_updated')`,
    ),
  ],
);
