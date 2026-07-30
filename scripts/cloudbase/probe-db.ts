#!/usr/bin/env node
/**
 * Probe CloudBase / Postgres connectivity without touching business data.
 * Usage: node --env-file-if-exists=.env.cloudbase.local --experimental-strip-types scripts/cloudbase/probe-db.ts
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  max: 1,
  ssl:
    process.env.PGSSL === "disable" || /sslmode=disable/i.test(url)
      ? false
      : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === "true" },
});

const client = await pool.connect();
try {
  const version = await client.query("select version() as version");
  const probes = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name like 'tencentdb_%'
    order by table_name
  `);
  const business = await client.query(`
    select count(*)::int as n
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'profiles'
  `);
  console.log(
    JSON.stringify(
      {
        ok: true,
        version: version.rows[0]?.version,
        probeTables: probes.rows.map((row) => row.table_name),
        profilesTablePresent: business.rows[0]?.n === 1,
        driver: process.env.DATABASE_DRIVER ?? "auto",
      },
      null,
      2,
    ),
  );
} finally {
  client.release();
  await pool.end();
}
