import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../drizzle/0008_lean_meggan.sql",
  import.meta.url,
);

test("notification migration deduplicates sticker retries and cascades deletes", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /ADD COLUMN "canvas_item_id" uuid/);
  assert.match(
    sql,
    /FOREIGN KEY \("canvas_item_id"\)[\s\S]*ON DELETE cascade/,
  );
  assert.match(sql, /activity_notifications_canvas_item_recipient_unique/);
  assert.match(sql, /'sticker_added'/);
  assert.match(
    sql,
    /"type" = 'sticker_added'[\s\S]*"canvas_item_id" is not null/,
  );
});

test("notification migration creates sticker reminders atomically", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /FUNCTION "notify_partner_on_sticker_added"/);
  assert.match(sql, /INSERT INTO "activity_notifications"/);
  assert.match(sql, /AFTER INSERT ON "entry_canvas_items"/);
  assert.match(sql, /WHEN \(NEW\."kind" = 'sticker'\)/);
  assert.match(sql, /EXECUTE FUNCTION "notify_partner_on_sticker_added"/);
});
