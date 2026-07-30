CREATE TABLE "auth_identity_map" (
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identity_map_provider_user_pk" PRIMARY KEY("provider","provider_user_id"),
	CONSTRAINT "auth_identity_map_provider_check" CHECK ("auth_identity_map"."provider" in ('neon', 'cloudbase'))
);
--> statement-breakpoint
ALTER TABLE "auth_identity_map" ADD CONSTRAINT "auth_identity_map_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identity_map_provider_profile_unique" ON "auth_identity_map" USING btree ("provider","profile_id");--> statement-breakpoint
CREATE INDEX "auth_identity_map_profile_id_idx" ON "auth_identity_map" USING btree ("profile_id");
