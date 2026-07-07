CREATE TABLE "chat_message_media" (
	"message_id" text NOT NULL,
	"media_id" uuid NOT NULL,
	CONSTRAINT "chat_message_media_message_id_media_id_pk" PRIMARY KEY("message_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" uuid NOT NULL,
	"sender_role" text NOT NULL,
	"render_type" text NOT NULL,
	"content" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"sort_seq" bigint NOT NULL,
	"reply_to_ref" text,
	"quote_title" text,
	"quote_content" text,
	"sequence" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_messages_sender_role_check" CHECK ("chat_messages"."sender_role" in ('self', 'partner', 'system'))
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"chapter_id" uuid,
	"category" text NOT NULL,
	"title" text,
	"body" text,
	"happened_at" timestamp with time zone NOT NULL,
	"happened_precision" text DEFAULT 'day' NOT NULL,
	"place_id" uuid,
	"mood" text,
	"weather" text,
	"rating" smallint,
	"source" text DEFAULT 'manual' NOT NULL,
	"source_ref" text,
	"is_highlight" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_category_check" CHECK ("entries"."category" in ('moment', 'diary', 'trip', 'first', 'milestone', 'anniversary', 'food', 'watch')),
	CONSTRAINT "entries_rating_check" CHECK ("entries"."rating" is null or ("entries"."rating" between 1 and 5))
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"thumbnail_r2_key" text,
	"mime" text,
	"type" text DEFAULT 'image' NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"sha256" text,
	"lat" double precision,
	"lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_type_check" CHECK ("media"."type" in ('image', 'video', 'audio'))
);
--> statement-breakpoint
CREATE TABLE "memory_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_ref" text,
	"kind" text DEFAULT 'day' NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_chapters_source_ref_unique" UNIQUE("source_ref")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"notes" text,
	"privacy_level" text DEFAULT 'approximate' NOT NULL,
	"precision_m" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_privacy_level_check" CHECK ("places"."privacy_level" in ('exact', 'approximate', 'private'))
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"color" text,
	"theme" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"title" text,
	"together_since" date,
	"first_met_on" date,
	"partner_a" uuid,
	"partner_b" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationship_single_row" CHECK ("relationship"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"done_entry_id" uuid,
	"created_by" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message_media" ADD CONSTRAINT "chat_message_media_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_media" ADD CONSTRAINT "chat_message_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_chapter_id_memory_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."memory_chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_partner_a_profiles_id_fk" FOREIGN KEY ("partner_a") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_partner_b_profiles_id_fk" FOREIGN KEY ("partner_b") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_done_entry_id_entries_id_fk" FOREIGN KEY ("done_entry_id") REFERENCES "public"."entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_entry_sent_at_idx" ON "chat_messages" USING btree ("entry_id","sent_at");--> statement-breakpoint
CREATE INDEX "entries_happened_at_idx" ON "entries" USING btree ("happened_at");--> statement-breakpoint
CREATE INDEX "entries_category_idx" ON "entries" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_source_source_ref_unique" ON "entries" USING btree ("source","source_ref") WHERE "entries"."source_ref" is not null;