CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"entry_id" uuid,
	"page_path" text,
	"page_title" text,
	"body" text,
	"reaction" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_events_kind_check" CHECK ("activity_events"."kind" in ('companion_message', 'page_message', 'reaction', 'summon', 'co_presence', 'visit', 'follow_up_created', 'follow_up_replied', 'entry_created', 'entry_updated'))
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_created_at_idx" ON "activity_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_events_entry_created_at_idx" ON "activity_events" USING btree ("entry_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_events_source_unique" ON "activity_events" USING btree ("source_type","source_id");--> statement-breakpoint
INSERT INTO "activity_events" ("actor_id", "kind", "source_type", "source_id", "entry_id", "page_path", "page_title", "body", "reaction", "created_at")
SELECT "author_id", 'companion_message', 'companion_message', "id"::text, NULL, "page_path", "page_title", "body", NULL, "created_at"
FROM "companion_messages"
ON CONFLICT ("source_type", "source_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "activity_events" ("actor_id", "kind", "source_type", "source_id", "entry_id", "page_path", "page_title", "body", "reaction", "created_at")
SELECT
  "author_id",
  CASE "event_type"
    WHEN 'message' THEN 'page_message'
    WHEN 'reaction' THEN 'reaction'
    WHEN 'summon' THEN 'summon'
    WHEN 'co_presence' THEN 'co_presence'
    ELSE 'visit'
  END,
  'footprint_event',
  "id"::text,
  NULL,
  "page_path",
  "page_title",
  "body",
  "reaction",
  "created_at"
FROM "footprint_events"
WHERE NOT ("event_type" = 'message' AND "scope" = 'site')
  AND ("target_type" IS NULL OR "target_type" <> 'follow_up')
ON CONFLICT ("source_type", "source_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "activity_events" ("actor_id", "kind", "source_type", "source_id", "entry_id", "page_path", "page_title", "body", "reaction", "created_at")
SELECT
  f."author_id",
  CASE WHEN f."parent_id" IS NULL THEN 'follow_up_created' ELSE 'follow_up_replied' END,
  'entry_follow_up',
  f."id"::text,
  f."entry_id",
  '/memories/' || f."entry_id"::text,
  e."title",
  f."body",
  NULL,
  f."created_at"
FROM "entry_follow_ups" f
LEFT JOIN "entries" e ON e."id" = f."entry_id"
ON CONFLICT ("source_type", "source_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "activity_events" ("actor_id", "kind", "source_type", "source_id", "entry_id", "page_path", "page_title", "body", "reaction", "created_at")
SELECT
  n."actor_id",
  CASE n."type" WHEN 'entry_created' THEN 'entry_created' ELSE 'entry_updated' END,
  'activity_notification',
  n."id"::text,
  n."entry_id",
  '/memories/' || n."entry_id"::text,
  e."title",
  n."body",
  NULL,
  n."created_at"
FROM "activity_notifications" n
LEFT JOIN "entries" e ON e."id" = n."entry_id"
WHERE n."type" IN ('entry_created', 'entry_updated')
  AND n."entry_id" IS NOT NULL
ON CONFLICT ("source_type", "source_id") DO NOTHING;
