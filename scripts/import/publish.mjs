import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  PUBLISH_ROOT,
  ensureWorkRoot,
  loadSharp,
  readWorkJson,
  resolveDataPath,
  sha256File,
} from "./shared.mjs";

const execFileAsync = promisify(execFile);
const APPLY = process.argv.includes("--apply");
const DRY_RUN = process.argv.includes("--dry-run") || !APPLY;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}。`);
  return value;
}

function contentType(file) {
  const extension = path.extname(file).toLowerCase();
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".m4a": "audio/mp4",
  }[extension] ?? "application/octet-stream";
}

function mediaType(file) {
  const mime = contentType(file);
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

async function commandExists(command) {
  try {
    await execFileAsync("/usr/bin/which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function transcodeVoice(input, output) {
  if (!(await commandExists("ffmpeg"))) {
    throw new Error(
      "选择了 WAV 语音，但系统没有 ffmpeg。请安装 ffmpeg 后重新发布；原始语音不会被修改。",
    );
  }
  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    output,
  ]);
}

async function prepareMedia(candidate, sourcePath, photoByPath) {
  const input = resolveDataPath(sourcePath);
  const extension = path.extname(input).toLowerCase();
  if (/\.(?:exe|msi|bat|cmd|com|scr|ps1)$/i.test(input)) {
    throw new Error(`危险附件被阻止：${sourcePath}`);
  }
  const originalSha256 = await sha256File(input);
  const prefix = path.join(PUBLISH_ROOT, candidate.id);
  await mkdir(prefix, { recursive: true });
  const baseName = originalSha256.slice(0, 20);
  const photo = photoByPath.get(sourcePath);

  if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
    const sharp = await loadSharp();
    const display = path.join(prefix, `${baseName}.webp`);
    const thumbnail = path.join(prefix, `${baseName}.thumb.webp`);
    const image = sharp(input).rotate();
    const metadata = await image.metadata();
    await image
      .clone()
      .resize({ width: 2_560, height: 2_560, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(display);
    await image
      .clone()
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(thumbnail);
    return {
      sourcePath,
      display,
      thumbnail,
      r2Key: `imports/${candidate.id}/${baseName}.webp`,
      thumbnailR2Key: `imports/${candidate.id}/${baseName}.thumb.webp`,
      mime: "image/webp",
      type: "image",
      width: metadata.autoOrient?.width ?? metadata.width ?? null,
      height: metadata.autoOrient?.height ?? metadata.height ?? null,
      sha256: originalSha256,
      capturedAt: photo?.capturedAt ?? candidate.startAt,
    };
  }

  if (extension === ".wav") {
    const display = path.join(prefix, `${baseName}.m4a`);
    await transcodeVoice(input, display);
    return {
      sourcePath,
      display,
      thumbnail: null,
      r2Key: `imports/${candidate.id}/${baseName}.m4a`,
      thumbnailR2Key: null,
      mime: "audio/mp4",
      type: "audio",
      width: null,
      height: null,
      sha256: originalSha256,
      capturedAt: candidate.startAt,
    };
  }

  if (extension === ".silk") {
    throw new Error(`SILK 语音尚未转换，已安全跳过发布：${sourcePath}`);
  }

  if (extension === ".mp4") {
    return {
      sourcePath,
      display: input,
      thumbnail: null,
      r2Key: `imports/${candidate.id}/${baseName}.mp4`,
      thumbnailR2Key: null,
      mime: "video/mp4",
      type: "video",
      width: null,
      height: null,
      sha256: originalSha256,
      capturedAt: candidate.startAt,
    };
  }

  throw new Error(`首期发布不支持这个附件类型：${sourcePath}`);
}

async function buildSummary(approved, chapters, photos, messages) {
  const approvedChapterIds = new Set(approved.map((candidate) => candidate.chapterId));
  const selectedPaths = new Set(approved.flatMap((candidate) => candidate.selectedMediaPaths));
  const selectedMessageIds = new Set(
    approved.flatMap((candidate) => candidate.selectedMessageIds),
  );
  const photoByPath = new Map(photos.map((photo) => [photo.sourcePath, photo]));
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const originalBytes = (
    await Promise.all(
      [...selectedPaths].map(async (sourcePath) => {
        const known = photoByPath.get(sourcePath)?.bytes;
        if (known != null) return known;
        try {
          return (await stat(resolveDataPath(sourcePath))).size;
        } catch {
          return 0;
        }
      }),
    )
  ).reduce((total, bytes) => total + bytes, 0);
  return {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? "apply" : "dry-run",
    chapters: chapters.filter((chapter) => approvedChapterIds.has(chapter.id)).length,
    events: approved.length,
    messages: selectedMessageIds.size,
    media: selectedPaths.size,
    originalMediaMiB: Number((originalBytes / 1024 / 1024).toFixed(1)),
    voices: [...selectedMessageIds]
      .map((id) => messageById.get(id))
      .filter((message) => message?.renderType === "voice").length,
    locations: {
      exact: approved.filter((candidate) => candidate.privacyLevel === "exact").length,
      approximate: approved.filter(
        (candidate) => candidate.privacyLevel === "approximate",
      ).length,
      private: approved.filter((candidate) => candidate.privacyLevel === "private")
        .length,
    },
    warnings: [
      ...(approved.length > 20
        ? ["首批批准事件超过 20 个，建议先缩小范围完成一次验收。"]
        : []),
      ...(approved.length === 0 ? ["还没有批准任何事件。"] : []),
    ],
  };
}

async function publish() {
  await ensureWorkRoot();
  await mkdir(PUBLISH_ROOT, { recursive: true });
  const manifestFile = path.join(PUBLISH_ROOT, "publication-manifest.json");
  const previousManifest = await readFile(manifestFile, "utf8")
    .then((value) => JSON.parse(value))
    .catch((error) => {
      if (error?.code === "ENOENT") return { events: {} };
      throw error;
    });
  const [candidates, chapters, photos, albumVideos, messages] = await Promise.all([
    readWorkJson("candidates.json", []),
    readWorkJson("chapters.json", []),
    readWorkJson("photos.json", []),
    readWorkJson("album-videos.json", []),
    readWorkJson("messages.json", []),
  ]);
  const approved = candidates.filter((candidate) => candidate.status === "approved");
  const summary = await buildSummary(
    approved,
    chapters,
    [...photos, ...albumVideos],
    messages,
  );
  console.log(JSON.stringify(summary, null, 2));
  if (DRY_RUN) return;
  if (!approved.length) throw new Error("没有已批准事件，拒绝空发布。");
  if (process.env.PUBLISH_CONFIRMED !== "YES") {
    throw new Error("实际发布需要显式设置 PUBLISH_CONFIRMED=YES。");
  }

  const databaseUrl = required("DATABASE_URL");
  const authorId = required("IMPORT_AUTHOR_ID");
  const accountId = required("R2_ACCOUNT_ID");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
  const bucket = required("R2_BUCKET");

  const [{ S3Client, PutObjectCommand, DeleteObjectCommand }, { neon }] =
    await Promise.all([
      import("@aws-sdk/client-s3"),
      import("@neondatabase/serverless"),
    ]);
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  const sql = neon(databaseUrl);
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const photoByPath = new Map(photos.map((photo) => [photo.sourcePath, photo]));
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    events: { ...(previousManifest.events ?? {}) },
  };

  for (const candidate of approved) {
    if (manifest.events[candidate.id]?.status === "published") {
      console.log(`跳过已发布事件：${candidate.id}`);
      continue;
    }
    const [existing] = await sql`
      select id from public.entries
      where source = 'wechat_import' and source_ref = ${candidate.sourceRef}
      limit 1
    `;
    if (existing) {
      manifest.events[candidate.id] = {
        status: "published",
        entryId: existing.id,
        skipped: true,
      };
      continue;
    }

    const chapter = chapterById.get(candidate.chapterId);
    if (!chapter) throw new Error(`事件 ${candidate.id} 缺少有效章节。`);
    const chapterId = randomUUID();
    const entryId = randomUUID();
    const placeId =
      candidate.location || candidate.placeName ? randomUUID() : null;
    const prepared = [];
    const uploadedKeys = [];
    try {
      for (const sourcePath of candidate.selectedMediaPaths) {
        const item = await prepareMedia(candidate, sourcePath, photoByPath);
        prepared.push({ ...item, id: randomUUID() });
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: item.r2Key,
            Body: await readFile(item.display),
            ContentType: item.mime,
          }),
        );
        uploadedKeys.push(item.r2Key);
        if (item.thumbnail && item.thumbnailR2Key) {
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: item.thumbnailR2Key,
              Body: await readFile(item.thumbnail),
              ContentType: "image/webp",
            }),
          );
          uploadedKeys.push(item.thumbnailR2Key);
        }
      }

      const queries = [
        sql`
          insert into public.memory_chapters
            (id, source_ref, kind, title, summary, started_at, ended_at)
          values
            (${chapterId}, ${chapter.id}, ${chapter.kind}, ${chapter.title},
             ${chapter.summary || null}, ${chapter.startAt}, ${chapter.endAt})
          on conflict (source_ref) do update set
            title = excluded.title,
            summary = excluded.summary,
            started_at = excluded.started_at,
            ended_at = excluded.ended_at,
            updated_at = now()
          returning id
        `,
      ];
      if (placeId) {
        queries.push(sql`
          insert into public.places
            (id, name, category, lat, lng, privacy_level, precision_m)
          values
            (${placeId}, ${candidate.placeName || "未命名地点"}, 'other',
             ${candidate.location?.latitude ?? null},
             ${candidate.location?.longitude ?? null},
             ${candidate.privacyLevel}, ${candidate.precisionM})
        `);
      }
      queries.push(sql`
        insert into public.entries
          (id, chapter_id, author_id, category, title, body, happened_at,
           happened_precision, place_id, source, source_ref, is_highlight)
        values
          (${entryId},
           (select id from public.memory_chapters where source_ref = ${chapter.id}),
           ${authorId}, ${candidate.category}, ${candidate.title},
           ${candidate.summary || null}, ${candidate.startAt}, 'exact', ${placeId},
           'wechat_import', ${candidate.sourceRef}, false)
      `);
      for (let index = 0; index < prepared.length; index += 1) {
        const item = prepared[index];
        queries.push(sql`
          insert into public.media
            (id, entry_id, r2_key, thumbnail_r2_key, mime, type, sort_order,
             captured_at, width, height, sha256, lat, lng)
          values
            (${item.id}, ${entryId}, ${item.r2Key}, ${item.thumbnailR2Key},
             ${item.mime}, ${item.type}, ${index}, ${item.capturedAt},
             ${item.width}, ${item.height}, ${item.sha256},
             ${candidate.location?.latitude ?? null},
             ${candidate.location?.longitude ?? null})
        `);
      }
      const selectedMessages = candidate.selectedMessageIds
        .map((id) => messageById.get(id))
        .filter(Boolean);
      for (let index = 0; index < selectedMessages.length; index += 1) {
        const message = selectedMessages[index];
        queries.push(sql`
          insert into public.chat_messages
            (id, entry_id, sender_role, render_type, content, sent_at, sort_seq,
             reply_to_ref, quote_title, quote_content, sequence)
          values
            (${message.id}, ${entryId}, ${message.senderRole}, ${message.renderType},
             ${message.content}, ${message.sentAt}, ${message.sortSeq},
             ${message.quote?.sourceServerId ?? null},
             ${message.quote?.title ?? null}, ${message.quote?.content ?? null}, ${index})
          on conflict (id) do nothing
        `);
        for (const linked of message.media) {
          const item = prepared.find((media) => media.sourcePath === linked.sourcePath);
          if (!item) continue;
          queries.push(sql`
            insert into public.chat_message_media (message_id, media_id)
            values (${message.id}, ${item.id})
            on conflict do nothing
          `);
        }
      }
      await sql.transaction(queries);
      manifest.events[candidate.id] = {
        status: "published",
        entryId,
        chapterSourceRef: chapter.id,
        mediaKeys: uploadedKeys,
        publishedAt: new Date().toISOString(),
      };
      await writeFile(
        manifestFile,
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
      console.log(`已发布：${candidate.title}`);
    } catch (error) {
      await Promise.allSettled(
        uploadedKeys.map((key) =>
          s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
        ),
      );
      throw error;
    }
  }
}

publish().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
