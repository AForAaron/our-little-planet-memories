import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";
import sharp from "sharp";

const args = process.argv.slice(2);
const apply = args.includes("--apply");

function numberFlag(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const limit = Math.min(numberFlag("--limit", 20), 500);
const delayMs = Math.min(numberFlag("--delay-ms", 150), 10_000);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少 ${name}。`);
  return value;
}

const config = {
  databaseUrl: required("DATABASE_URL"),
  accountId: required("R2_ACCOUNT_ID"),
  accessKeyId: required("R2_ACCESS_KEY_ID"),
  secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  bucket: required("R2_BUCKET"),
};

const sql = neon(config.databaseUrl);
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
});

function thumbnailKeyFor(r2Key) {
  const extension = r2Key.lastIndexOf(".");
  const base = extension > r2Key.lastIndexOf("/") ? r2Key.slice(0, extension) : r2Key;
  return `${base}.thumb.webp`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const rows = await sql`
  select id, r2_key
  from public.media
  where type = 'image' and thumbnail_r2_key is null
  order by created_at asc
  limit ${limit}
`;

console.log(`${apply ? "开始回填" : "Dry run"}：发现 ${rows.length} 个缺少缩略图的图片（本批上限 ${limit}）。`);

for (let index = 0; index < rows.length; index += 1) {
  const row = rows[index];
  const thumbnailR2Key = thumbnailKeyFor(row.r2_key);
  console.log(`[${index + 1}/${rows.length}] ${row.id} -> ${thumbnailR2Key}`);
  if (!apply) continue;

  const source = await r2.send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: row.r2_key,
  }));
  if (!source.Body) throw new Error(`无法读取 ${row.r2_key}。`);
  const sourceBytes = await source.Body.transformToByteArray();
  const thumbnail = await sharp(sourceBytes)
    .rotate()
    .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  await r2.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: thumbnailR2Key,
    Body: thumbnail,
    ContentType: "image/webp",
  }));
  await sql`
    update public.media
    set thumbnail_r2_key = ${thumbnailR2Key}
    where id = ${row.id} and thumbnail_r2_key is null
  `;

  if (delayMs && index < rows.length - 1) await sleep(delayMs);
}

console.log(apply ? "本批缩略图回填完成。" : "Dry run 完成；确认后使用 --apply 执行。");
