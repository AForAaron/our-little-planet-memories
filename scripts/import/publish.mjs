import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, open, readFile, stat, unlink, writeFile } from "node:fs/promises";
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
const SUPPORTED_MEDIA_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".mp4", ".wav"]);
const DANGEROUS_MEDIA_EXTENSIONS = new Set([".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".ps1"]);
const PROGRESS_FILE = process.env.PUBLISH_PROGRESS_FILE;
const progress = {
  status: DRY_RUN ? "dry-run" : "running",
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  phase: DRY_RUN ? "预览" : "准备发布",
  current: 0,
  total: 0,
  summary: null,
  error: null,
  logs: [],
};

async function writeProgress(patch = {}) {
  if (!PROGRESS_FILE) return;
  Object.assign(progress, patch, { updatedAt: new Date().toISOString() });
  await mkdir(path.dirname(PROGRESS_FILE), { recursive: true });
  await writeFile(PROGRESS_FILE, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
}

async function progressLog(message, patch = {}) {
  const entry = {
    at: new Date().toISOString(),
    message,
  };
  progress.logs = [...progress.logs, entry].slice(-200);
  await writeProgress({ ...patch, lastMessage: message });
}

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

async function withPublishLock(task) {
  if (DRY_RUN) return await task();
  const lockFile = path.join(PUBLISH_ROOT, "publication.lock");
  let handle;
  try {
    handle = await open(lockFile, "wx");
    await handle.writeFile(
      JSON.stringify(
        {
          pid: process.pid,
          startedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        "另一个发布任务正在运行。如果确认没有任务在跑，请检查并删除 publish 目录下的 publication.lock 后重试。",
      );
    }
    throw error;
  } finally {
    await handle?.close();
  }

  try {
    return await task();
  } finally {
    await unlink(lockFile).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
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
      ...(approved.length === 0 ? ["没有新的已批准事件需要发布。"] : []),
    ],
  };
}

async function readPublicationManifest() {
  const manifestFile = path.join(PUBLISH_ROOT, "publication-manifest.json");
  return await readFile(manifestFile, "utf8")
    .then((value) => JSON.parse(value))
    .catch((error) => {
      if (error?.code === "ENOENT") return { events: {} };
      throw error;
    });
}

function pendingApprovedCandidates(approved, manifest) {
  const published = manifest.events ?? {};
  return approved.filter(
    (candidate) => published[candidate.id]?.status !== "published",
  );
}

async function preflightPublication(approved, chapters, messages) {
  const blockers = [];
  const warnings = [];
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));
  const messageIds = new Set(messages.map((message) => message.id));
  const seenCandidateIds = new Map();
  const seenSourceRefs = new Map();
  const seenSelectedMessages = new Map();
  let wavCount = 0;

  for (const candidate of approved) {
    if (!candidate.id) {
      blockers.push("发现缺少 id 的已批准事件。");
      continue;
    }
    if (seenCandidateIds.has(candidate.id)) {
      blockers.push(`事件 id 重复：${candidate.id}`);
    }
    seenCandidateIds.set(candidate.id, candidate);

    if (!candidate.sourceRef) {
      blockers.push(`事件 ${candidate.id} 缺少 sourceRef。`);
    } else if (seenSourceRefs.has(candidate.sourceRef)) {
      blockers.push(`事件 sourceRef 重复：${candidate.sourceRef}`);
    }
    seenSourceRefs.set(candidate.sourceRef, candidate);

    if (!chapterIds.has(candidate.chapterId)) {
      blockers.push(`事件 ${candidate.id} 缺少有效章节：${candidate.chapterId}`);
    }

    const candidateMediaPaths = new Set(candidate.mediaPaths ?? []);
    const selectedMediaPaths = candidate.selectedMediaPaths ?? [];
    const selectedMediaSet = new Set();
    for (const sourcePath of selectedMediaPaths) {
      if (selectedMediaSet.has(sourcePath)) {
        blockers.push(`事件 ${candidate.id} 重复选择了同一个媒体：${sourcePath}`);
      }
      selectedMediaSet.add(sourcePath);

      if (!candidateMediaPaths.has(sourcePath)) {
        blockers.push(`事件 ${candidate.id} 选择了不属于它的媒体：${sourcePath}`);
      }

      const extension = path.extname(sourcePath).toLowerCase();
      if (DANGEROUS_MEDIA_EXTENSIONS.has(extension)) {
        blockers.push(`事件 ${candidate.id} 选择了危险附件：${sourcePath}`);
      } else if (extension === ".silk") {
        blockers.push(`事件 ${candidate.id} 选择了尚不支持发布的 SILK 语音：${sourcePath}`);
      } else if (!SUPPORTED_MEDIA_EXTENSIONS.has(extension)) {
        blockers.push(`事件 ${candidate.id} 选择了首期发布不支持的附件类型：${sourcePath}`);
      }

      if (extension === ".wav") wavCount += 1;
      try {
        await stat(resolveDataPath(sourcePath));
      } catch {
        blockers.push(`事件 ${candidate.id} 选择的媒体文件不存在或不可读：${sourcePath}`);
      }
    }

    const selectedMessageSet = new Set();
    for (const messageId of candidate.selectedMessageIds ?? []) {
      if (selectedMessageSet.has(messageId)) {
        blockers.push(`事件 ${candidate.id} 重复选择了同一条消息：${messageId}`);
      }
      selectedMessageSet.add(messageId);
      if (!messageIds.has(messageId)) {
        blockers.push(`事件 ${candidate.id} 选择了不存在的消息：${messageId}`);
      }
      const previous = seenSelectedMessages.get(messageId);
      if (previous && previous !== candidate.id) {
        blockers.push(`消息 ${messageId} 同时被事件 ${previous} 和 ${candidate.id} 选择。`);
      }
      seenSelectedMessages.set(messageId, candidate.id);
    }
  }

  if (wavCount > 0 && !(await commandExists("ffmpeg"))) {
    blockers.push(
      `已批准内容中有 ${wavCount} 个 WAV 语音，但系统没有 ffmpeg。请安装 ffmpeg，或取消选择这些 WAV 语音。`,
    );
  }

  if (approved.length > 20) {
    warnings.push("首批批准事件超过 20 个，建议先缩小范围完成一次验收。");
  }

  return { blockers, warnings };
}

async function verifyDatabaseReady(sql, authorId) {
  const [tables] = await sql`
    select
      to_regclass('public.profiles') as profiles,
      to_regclass('public.memory_chapters') as memory_chapters,
      to_regclass('public.entries') as entries,
      to_regclass('public.media') as media,
      to_regclass('public.chat_messages') as chat_messages,
      to_regclass('public.chat_message_media') as chat_message_media
  `;
  const missingTables = Object.entries(tables)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missingTables.length) {
    throw new Error(`数据库缺少发布所需表，请先运行 migration：${missingTables.join(", ")}`);
  }

  const [author] = await sql`
    select id from public.profiles where id = ${authorId} limit 1
  `;
  if (!author) {
    throw new Error(`IMPORT_AUTHOR_ID 没有对应的 public.profiles 记录：${authorId}`);
  }
}

async function publish() {
  await writeProgress();
  await progressLog("读取审核工作数据", { phase: "读取数据" });
  await ensureWorkRoot();
  await mkdir(PUBLISH_ROOT, { recursive: true });
  const [candidates, chapters, photos, albumVideos, messages] = await Promise.all([
    readWorkJson("candidates.json", []),
    readWorkJson("chapters.json", []),
    readWorkJson("photos.json", []),
    readWorkJson("album-videos.json", []),
    readWorkJson("messages.json", []),
  ]);
  const approved = candidates.filter((candidate) => candidate.status === "approved");
  const publicationManifest = await readPublicationManifest();
  const pendingApproved = pendingApprovedCandidates(approved, publicationManifest);
  const summary = await buildSummary(
    pendingApproved,
    chapters,
    [...photos, ...albumVideos],
    messages,
  );
  const publishedCount = approved.length - pendingApproved.length;
  summary.approved = approved.length;
  summary.pending = pendingApproved.length;
  summary.published = publishedCount;
  await progressLog(`找到 ${pendingApproved.length} 个待发布事件，${publishedCount} 个已发布事件`, {
    phase: "发布前检查",
    total: pendingApproved.length,
    summary,
  });
  const preflight = await preflightPublication(pendingApproved, chapters, messages);
  console.log(JSON.stringify({ ...summary, preflight }, null, 2));
  if (DRY_RUN) return;
  if (!pendingApproved.length) throw new Error("没有新的已批准事件需要发布。");
  if (preflight.blockers.length) {
    throw new Error(`发布前检查未通过：\n- ${preflight.blockers.join("\n- ")}`);
  }
  if (process.env.PUBLISH_CONFIRMED !== "YES") {
    throw new Error("实际发布需要显式设置 PUBLISH_CONFIRMED=YES。");
  }

  const databaseUrl = required("DATABASE_URL");
  const authorId = required("IMPORT_AUTHOR_ID");
  const accountId = required("R2_ACCOUNT_ID");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
  const bucket = required("R2_BUCKET");

  await progressLog("等待发布锁", { phase: "等待发布锁" });
  await withPublishLock(async () => {
    await progressLog("已获得发布锁，读取发布 manifest", { phase: "读取发布记录" });
    const manifestFile = path.join(PUBLISH_ROOT, "publication-manifest.json");
    const previousManifest = await readPublicationManifest();
    const [{ S3Client, PutObjectCommand, DeleteObjectCommand }, { neon }] =
      await Promise.all([
        import("@aws-sdk/client-s3"),
        import("@neondatabase/serverless"),
      ]);
    await progressLog("连接 R2 和 Neon", { phase: "连接云端" });
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    const sql = neon(databaseUrl);
    await progressLog("检查数据库表和发布作者", { phase: "检查数据库" });
    await verifyDatabaseReady(sql, authorId);
    const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    const photoByPath = new Map(photos.map((photo) => [photo.sourcePath, photo]));
    const messageById = new Map(messages.map((message) => [message.id, message]));
    const manifest = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      events: { ...(previousManifest.events ?? {}) },
    };

    for (let candidateIndex = 0; candidateIndex < pendingApproved.length; candidateIndex += 1) {
      const candidate = pendingApproved[candidateIndex];
      const current = candidateIndex + 1;
      await progressLog(`处理事件 ${current}/${pendingApproved.length}：${candidate.title}`, {
        phase: "处理事件",
        current,
        total: pendingApproved.length,
      });
      if (manifest.events[candidate.id]?.status === "published") {
        await progressLog(`跳过已发布事件：${candidate.title}`, {
          phase: "跳过已发布",
          current,
          total: pendingApproved.length,
        });
        console.log(`跳过已发布事件：${candidate.id}`);
        continue;
      }
      const [existing] = await sql`
        select id from public.entries
        where source = 'wechat_import' and source_ref = ${candidate.sourceRef}
        limit 1
      `;
      if (existing) {
        await progressLog(`云端已存在，标记跳过：${candidate.title}`, {
          phase: "跳过已存在",
          current,
          total: pendingApproved.length,
        });
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
        for (let mediaIndex = 0; mediaIndex < candidate.selectedMediaPaths.length; mediaIndex += 1) {
          const sourcePath = candidate.selectedMediaPaths[mediaIndex];
          await progressLog(
            `处理媒体 ${mediaIndex + 1}/${candidate.selectedMediaPaths.length}：${path.basename(sourcePath)}`,
            { phase: "处理媒体", current, total: pendingApproved.length },
          );
          const item = await prepareMedia(candidate, sourcePath, photoByPath);
          prepared.push({ ...item, id: randomUUID() });
          await progressLog(`上传媒体：${path.basename(item.r2Key)}`, {
            phase: "上传 R2",
            current,
            total: pendingApproved.length,
          });
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
            await progressLog(`上传缩略图：${path.basename(item.thumbnailR2Key)}`, {
              phase: "上传 R2",
              current,
              total: pendingApproved.length,
            });
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

        await progressLog(`写入数据库：${candidate.title}`, {
          phase: "写入数据库",
          current,
          total: pendingApproved.length,
        });
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
        await progressLog(`写入发布记录：${candidate.title}`, {
          phase: "写入发布记录",
          current,
          total: pendingApproved.length,
        });
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
        await progressLog(`事件失败，清理已上传媒体：${candidate.title}`, {
          phase: "失败清理",
          current,
          total: pendingApproved.length,
        });
        await Promise.allSettled(
          uploadedKeys.map((key) =>
            s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
          ),
        );
        throw error;
      }
    }
  });
  await progressLog("发布完成", {
    status: "completed",
    phase: "完成",
    current: pendingApproved.length,
    total: pendingApproved.length,
  });
}

publish().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  writeProgress({
    status: "failed",
    phase: "失败",
    error: message,
  }).finally(() => {
    console.error(message);
    process.exitCode = 1;
  });
});
