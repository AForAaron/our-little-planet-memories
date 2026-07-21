import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../drizzle/0007_plain_dakota_north.sql",
  import.meta.url,
);

test("canvas migration cascades with entries and indexes paint order", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /FOREIGN KEY \("entry_id"\)[\s\S]*ON DELETE cascade/);
  assert.match(sql, /entry_canvas_items_entry_z_index_idx/);
});

test("canvas migration serializes and enforces the 150-item limit", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /count\(\*\)[\s\S]*>= 150/);
  assert.match(sql, /entry_canvas_items_limit_check/);
  assert.match(sql, /BEFORE INSERT ON "entry_canvas_items"/);
});
