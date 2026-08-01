#!/usr/bin/env node
/**
 * Read-only Neon snapshot helper (M5).
 * Exports table row counts + optional JSON dumps for public business tables.
 * Never writes to Neon. Never prints connection secrets.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local scripts/cloudbase/export-neon-snapshot.mjs
 *   node --env-file-if-exists=.env.local scripts/cloudbase/export-neon-snapshot.mjs --with-data
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const WITH_DATA = process.argv.includes("--with-data");
const OUT_DIR =
  process.env.SNAPSHOT_OUT_DIR ||
  path.resolve(process.cwd(), "../Web-private/backups/neon-snapshots");

const BUSINESS_TABLES = [
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
  "activity_notifications",
  "companion_messages",
  "entry_follow_ups",
  "activity_events",
  "entry_canvas_items",
  "auth_identity_map",
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.join(OUT_DIR, stamp);
await mkdir(runDir, { recursive: true });

const client = await pool.connect();
try {
  await client.query("begin read only");
  const counts = {};
  for (const table of BUSINESS_TABLES) {
    const exists = await client.query(
      `select to_regclass($1) is not null as ok`,
      [`public.${table}`],
    );
    if (!exists.rows[0]?.ok) {
      counts[table] = null;
      continue;
    }
    const { rows } = await client.query(
      `select count(*)::int as n from public.${table}`,
    );
    counts[table] = rows[0].n;
    if (WITH_DATA) {
      const data = await client.query(`select * from public.${table}`);
      await writeFile(
        path.join(runDir, `${table}.json`),
        JSON.stringify(data.rows, null, 2),
      );
    }
  }
  await client.query("commit");
  await writeFile(
    path.join(runDir, "counts.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), counts }, null, 2),
  );
  console.log(
    JSON.stringify(
      { ok: true, outDir: runDir, withData: WITH_DATA, counts },
      null,
      2,
    ),
  );
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
