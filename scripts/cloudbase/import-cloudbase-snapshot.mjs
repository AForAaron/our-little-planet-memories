#!/usr/bin/env node
/**
 * Import a Neon JSON snapshot into CloudBase Postgres (M5).
 * Source Neon is never modified. Target business tables can be truncated and re-run.
 * System probe tables (tencentdb_*) are never touched.
 *
 * Usage:
 *   node --env-file-if-exists=.env.cloudbase.local scripts/cloudbase/import-cloudbase-snapshot.mjs --dir ../Web-private/backups/neon-snapshots/<stamp> --dry-run
 *   node --env-file-if-exists=.env.cloudbase.local scripts/cloudbase/import-cloudbase-snapshot.mjs --dir ... --apply
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const dir = argValue("--dir");
const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;

if (!dir) {
  console.error("需要 --dir <snapshot-dir>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("缺少 DATABASE_URL（目标 CloudBase）");
  process.exit(1);
}

const IMPORT_ORDER = [
  "profiles",
  "relationship",
  "memory_chapters",
  "places",
  "entries",
  "media",
  "wishlist_items",
  "chat_messages",
  "chat_message_media",
  "footprint_events",
  "presence_state",
  "profile_emoji_usage",
  "companion_messages",
  "entry_follow_ups",
  // canvas items before notifications that may reference canvas_item_id
  "entry_canvas_items",
  "activity_notifications",
  "activity_events",
  "auth_identity_map",
];

const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  ssl:
    process.env.PGSSL === "disable"
      ? undefined
      : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === "true" },
});

const countsPath = path.join(dir, "counts.json");
const countsDoc = JSON.parse(await readFile(countsPath, "utf8"));

console.log(
  JSON.stringify(
    {
      mode: dryRun ? "dry-run" : "apply",
      sourceCounts: countsDoc.counts,
      warning:
        "apply 会按外键逆序清空业务表后导入；不会删除 tencentdb_* 探测表。",
    },
    null,
    2,
  ),
);

if (dryRun) {
  process.exit(0);
}

const client = await pool.connect();
try {
  await client.query("begin");
  for (const table of [...IMPORT_ORDER].reverse()) {
    const exists = await client.query(
      `select to_regclass($1) is not null as ok`,
      [`public.${table}`],
    );
    if (!exists.rows[0]?.ok) continue;
    await client.query(`truncate table public.${table} cascade`);
  }

  for (const table of IMPORT_ORDER) {
    let rows;
    try {
      rows = JSON.parse(
        await readFile(path.join(dir, `${table}.json`), "utf8"),
      );
    } catch {
      continue;
    }
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const columns = Object.keys(rows[0]);
    for (const row of rows) {
      const values = columns.map((column) => row[column]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(
        `insert into public.${table} (${columns.map((c) => `"${c}"`).join(", ")})
         values (${placeholders})
         on conflict do nothing`,
        values,
      );
    }
    console.log(`imported ${table}: ${rows.length}`);
  }
  await client.query("commit");
  console.log(JSON.stringify({ ok: true }, null, 2));
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    // ignore
  }
  console.error(error);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
