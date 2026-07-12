CREATE TABLE "profile_emoji_usage" (
	"profile_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_emoji_usage_profile_id_emoji_pk" PRIMARY KEY("profile_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "profile_emoji_usage" ADD CONSTRAINT "profile_emoji_usage_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_emoji_usage_common_idx" ON "profile_emoji_usage" USING btree ("profile_id","use_count","last_used_at");