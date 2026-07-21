CREATE TABLE "entry_canvas_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entry_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"anchor_key" text NOT NULL,
	"x_ratio" double precision NOT NULL,
	"y_ratio" double precision NOT NULL,
	"width_ratio" double precision NOT NULL,
	"rotation" double precision DEFAULT 0 NOT NULL,
	"opacity" double precision DEFAULT 1 NOT NULL,
	"z_index" integer DEFAULT 0 NOT NULL,
	"payload" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_canvas_items_kind_check" CHECK ("entry_canvas_items"."kind" in ('sticker', 'stroke')),
	CONSTRAINT "entry_canvas_items_anchor_key_check" CHECK (char_length("entry_canvas_items"."anchor_key") between 1 and 128),
	CONSTRAINT "entry_canvas_items_x_ratio_check" CHECK ("entry_canvas_items"."x_ratio" between -0.5 and 1.5),
	CONSTRAINT "entry_canvas_items_y_ratio_check" CHECK ("entry_canvas_items"."y_ratio" between -0.5 and 1.5),
	CONSTRAINT "entry_canvas_items_width_ratio_check" CHECK ("entry_canvas_items"."width_ratio" between 0.03 and 1),
	CONSTRAINT "entry_canvas_items_rotation_check" CHECK ("entry_canvas_items"."rotation" between -360 and 360),
	CONSTRAINT "entry_canvas_items_opacity_check" CHECK ("entry_canvas_items"."opacity" between 0.1 and 1),
	CONSTRAINT "entry_canvas_items_z_index_check" CHECK ("entry_canvas_items"."z_index" between -10000 and 10000),
	CONSTRAINT "entry_canvas_items_revision_check" CHECK ("entry_canvas_items"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "entry_canvas_items" ADD CONSTRAINT "entry_canvas_items_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_canvas_items" ADD CONSTRAINT "entry_canvas_items_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_canvas_items_entry_z_index_idx" ON "entry_canvas_items" USING btree ("entry_id","z_index");--> statement-breakpoint
CREATE FUNCTION "enforce_entry_canvas_item_limit"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM pg_advisory_xact_lock(hashtextextended(NEW.entry_id::text, 0));
	IF (SELECT count(*) FROM "entry_canvas_items" WHERE "entry_id" = NEW.entry_id) >= 150 THEN
		RAISE EXCEPTION 'entry_canvas_items limit exceeded'
			USING ERRCODE = '23514', CONSTRAINT = 'entry_canvas_items_limit_check';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "entry_canvas_items_limit_trigger"
BEFORE INSERT ON "entry_canvas_items"
FOR EACH ROW EXECUTE FUNCTION "enforce_entry_canvas_item_limit"();
