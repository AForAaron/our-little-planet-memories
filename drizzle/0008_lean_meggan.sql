ALTER TABLE "activity_notifications" DROP CONSTRAINT "activity_notifications_type_check";--> statement-breakpoint
ALTER TABLE "activity_notifications" ADD COLUMN "canvas_item_id" uuid;--> statement-breakpoint
ALTER TABLE "activity_notifications" ADD CONSTRAINT "activity_notifications_canvas_item_id_entry_canvas_items_id_fk" FOREIGN KEY ("canvas_item_id") REFERENCES "public"."entry_canvas_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_notifications_canvas_item_recipient_unique" ON "activity_notifications" USING btree ("canvas_item_id","recipient_id");--> statement-breakpoint
ALTER TABLE "activity_notifications" ADD CONSTRAINT "activity_notifications_canvas_item_check" CHECK ((
        "activity_notifications"."type" = 'sticker_added'
        and "activity_notifications"."canvas_item_id" is not null
        and "activity_notifications"."entry_id" is not null
        and "activity_notifications"."follow_up_id" is null
      ) or (
        "activity_notifications"."type" <> 'sticker_added'
        and "activity_notifications"."canvas_item_id" is null
      ));--> statement-breakpoint
ALTER TABLE "activity_notifications" ADD CONSTRAINT "activity_notifications_type_check" CHECK ("activity_notifications"."type" in ('entry_created', 'entry_updated', 'follow_up_created', 'follow_up_replied', 'sticker_added'));--> statement-breakpoint
CREATE OR REPLACE FUNCTION "notify_partner_on_sticker_added"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  recipient_uuid uuid;
  actor_name text;
  memory_title text;
BEGIN
  SELECT "id"
  INTO recipient_uuid
  FROM "profiles"
  WHERE "id" <> NEW."author_id"
  ORDER BY "created_at" ASC, "id" ASC
  LIMIT 1;

  IF recipient_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nullif(btrim("title"), '')
  INTO memory_title
  FROM "entries"
  WHERE "id" = NEW."entry_id";

  SELECT coalesce(nullif(btrim("display_name"), ''), '对方')
  INTO actor_name
  FROM "profiles"
  WHERE "id" = NEW."author_id";

  INSERT INTO "activity_notifications" (
    "recipient_id",
    "actor_id",
    "type",
    "entry_id",
    "canvas_item_id",
    "title",
    "body",
    "href"
  ) VALUES (
    recipient_uuid,
    NEW."author_id",
    'sticker_added',
    NEW."entry_id",
    NEW."id",
    coalesce(actor_name, '对方') || ' 给《' || coalesce(memory_title, '无题回忆') || '》贴了一张新贴纸',
    '打开帖子看看这张新贴纸吧。',
    '/memories/' || NEW."entry_id"::text
  )
  ON CONFLICT ("canvas_item_id", "recipient_id") DO NOTHING;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "entry_canvas_items_sticker_notification_trigger"
AFTER INSERT ON "entry_canvas_items"
FOR EACH ROW
WHEN (NEW."kind" = 'sticker')
EXECUTE FUNCTION "notify_partner_on_sticker_added"();
