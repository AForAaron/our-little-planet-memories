CREATE TABLE "footprint_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"scope" text DEFAULT 'page' NOT NULL,
	"page_path" text NOT NULL,
	"page_title" text,
	"target_type" text,
	"target_id" text,
	"body" text,
	"reaction" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "footprint_events_event_type_check" CHECK ("footprint_events"."event_type" in ('message', 'reaction', 'summon', 'co_presence', 'visit')),
	CONSTRAINT "footprint_events_scope_check" CHECK ("footprint_events"."scope" in ('site', 'page', 'entry', 'wishlist', 'place'))
);
--> statement-breakpoint
CREATE TABLE "presence_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_path" text NOT NULL,
	"page_title" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "footprint_events" ADD CONSTRAINT "footprint_events_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_state" ADD CONSTRAINT "presence_state_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "footprint_events_created_at_idx" ON "footprint_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "footprint_events_page_path_idx" ON "footprint_events" USING btree ("page_path","created_at");