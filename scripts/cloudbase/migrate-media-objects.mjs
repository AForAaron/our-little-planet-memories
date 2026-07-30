#!/usr/bin/env node
/**
 * Copy private objects referenced by media.r2_key / thumbnail_r2_key
 * from R2 (source) to S3-compatible CloudBase/COS (target). M6.
 *
 * Requires source R2_* and target S3_* env vars.
 * Never uploads Web-private/raw.
 *
 * Usage:
 *   node --env-file-if-exists=.env.local scripts/cloudbase/migrate-media-objects.mjs --dry-run
 *   # with S3_* also loaded:
 *   node --import=tsx --env-file=.env.media-migration.local scripts/cloudbase/migrate-media-objects.mjs --apply
 */
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import pg from "pg";

const apply = process.argv.includes("--apply");
const dryRun = !apply;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
}

const dbUrl = requireEnv("DATABASE_URL");
const source = new S3Client({
  region: "auto",
  endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },
});
const sourceBucket = requireEnv("R2_BUCKET");

const target = new S3Client({
  region: process.env.S3_REGION || "ap-shanghai",
  endpoint: requireEnv("S3_ENDPOINT"),
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "0",
  credentials: {
    accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
  },
});
const targetBucket = requireEnv("S3_BUCKET");

const pool = new pg.Pool({ connectionString: dbUrl, max: 1, ssl: { rejectUnauthorized: false } });
const { rows } = await pool.query(`
  select distinct key from (
    select r2_key as key from media where r2_key is not null and r2_key <> ''
    union
    select thumbnail_r2_key as key from media where thumbnail_r2_key is not null and thumbnail_r2_key <> ''
  ) keys
  order by key
`);
await pool.end();

console.log(JSON.stringify({ mode: dryRun ? "dry-run" : "apply", objectCount: rows.length }, null, 2));

let copied = 0;
let skipped = 0;
for (const { key } of rows) {
  try {
    await target.send(new HeadObjectCommand({ Bucket: targetBucket, Key: key }));
    skipped += 1;
    continue;
  } catch {
    // missing on target → copy
  }
  if (dryRun) {
    copied += 1;
    continue;
  }
  const obj = await source.send(
    new GetObjectCommand({ Bucket: sourceBucket, Key: key }),
  );
  const bytes = Buffer.from(await obj.Body.transformToByteArray());
  await target.send(
    new PutObjectCommand({
      Bucket: targetBucket,
      Key: key,
      Body: bytes,
      ContentType: obj.ContentType,
    }),
  );
  copied += 1;
}

console.log(JSON.stringify({ ok: true, copied, skipped, dryRun }, null, 2));
// silence unused import if bundlers complain
void CopyObjectCommand;
