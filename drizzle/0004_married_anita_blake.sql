CREATE TABLE "activity_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"type" text NOT NULL,
	"entry_id" uuid,
	"follow_up_id" uuid,
	"title" text NOT NULL,
	"body" text,
	"href" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_notifications_type_check" CHECK ("activity_notifications"."type" in ('entry_created', 'entry_updated', 'follow_up_created', 'follow_up_replied'))
);
--> statement-breakpoint
CREATE TABLE "companion_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"page_path" text,
	"page_title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_notifications" ADD CONSTRAINT "activity_notifications_recipient_id_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_notifications" ADD CONSTRAINT "activity_notifications_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_notifications" ADD CONSTRAINT "activity_notifications_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_notifications" ADD CONSTRAINT "activity_notifications_follow_up_id_entry_follow_ups_id_fk" FOREIGN KEY ("follow_up_id") REFERENCES "public"."entry_follow_ups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_messages" ADD CONSTRAINT "companion_messages_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_follow_ups" ADD CONSTRAINT "entry_follow_ups_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_follow_ups" ADD CONSTRAINT "entry_follow_ups_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_notifications_recipient_created_at_idx" ON "activity_notifications" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_notifications_unread_idx" ON "activity_notifications" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "companion_messages_created_at_idx" ON "companion_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "entry_follow_ups_entry_created_at_idx" ON "entry_follow_ups" USING btree ("entry_id","created_at");--> statement-breakpoint
CREATE INDEX "entry_follow_ups_parent_idx" ON "entry_follow_ups" USING btree ("parent_id");--> statement-breakpoint
INSERT INTO "companion_messages" ("id", "author_id", "body", "page_path", "page_title", "created_at")
SELECT "id", "author_id", coalesce("body", ''), "page_path", "page_title", "created_at"
FROM "footprint_events"
WHERE "event_type" = 'message'
	AND "scope" = 'site'
	AND "body" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "entry_follow_ups" ("id", "entry_id", "author_id", "parent_id", "body", "created_at", "updated_at")
SELECT "id", "target_id"::uuid, "author_id", NULL, coalesce("body", ''), "created_at", "created_at"
FROM "footprint_events"
WHERE "target_type" = 'follow_up'
	AND "target_id" IS NOT NULL
	AND "target_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
	AND "body" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
