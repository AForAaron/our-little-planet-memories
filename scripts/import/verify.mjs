import { unlink } from "node:fs/promises";
import path from "node:path";
import {
  WORK_ROOT,
  loadSharp,
  readWorkJson,
  resolveDataPath,
} from "./shared.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

async function main() {
  const [photos, albumVideos, messages, segments, candidates, stats] = await Promise.all([
    readWorkJson("photos.json", []),
    readWorkJson("album-videos.json", []),
    readWorkJson("messages.json", []),
    readWorkJson("segments.json", []),
    readWorkJson("candidates.json", []),
    readWorkJson("stats.json", null),
  ]);

  assert(photos.length === 300, "读取到 300 张独立相册照片");
  assert(albumVideos.length === 4, "读取到 4 个独立相册视频");
  assert(
    photos.every((photo) => photo.capturedAt && photo.rawLocation),
    "每张相册照片都有拍摄时间和 GPS",
  );
  assert(messages.length === 67_553, "规范化 67,553 条聊天消息");
  assert(
    messages.every((message) => !Object.hasOwn(message, "serverId")),
    "规范化数据没有保存不安全的数值 serverId",
  );
  const messageIds = new Set(messages.map((message) => message.id));
  assert(messageIds.size === messages.length, "字符串消息 ID 全部唯一");
  assert(
    messages
      .flatMap((message) => message.media)
      .every((media) => media.exists),
    "全部离线媒体引用都能解析",
  );
  assert(
    stats?.chat?.blockedAttachments === 2,
    "两个 EXE 附件已被安全标记为阻止",
  );
  assert(segments.length >= 945, "聊天已按跨日、间隔和体量切成基础段");
  assert(
    Math.max(...candidates.map((candidate) => candidate.messageIds.length)) <= 400,
    "单个审核候选不超过 400 条消息",
  );
  assert(
    candidates.every((candidate) =>
      candidate.selectedMediaPaths.every((sourcePath) =>
        candidate.mediaPaths.includes(sourcePath),
      ),
    ),
    "精选媒体始终属于候选事件",
  );
  assert(
    albumVideos.every((video) =>
      candidates.some((candidate) =>
        candidate.mediaPaths.includes(video.sourcePath),
      ),
    ),
    "4 个独立相册视频全部进入照片事件候选",
  );
  assert(
    candidates.every(
      (candidate) =>
        candidate.privacyLevel === "exact" ||
        !candidate.rawLocation ||
        candidate.location?.latitude !== candidate.rawLocation.latitude ||
        candidate.location?.longitude !== candidate.rawLocation.longitude,
    ),
    "未标记为公开景点的坐标都经过降精度处理",
  );

  const sample = photos[0];
  const sharp = await loadSharp();
  const output = path.join(WORK_ROOT, "verification-no-exif.webp");
  await sharp(resolveDataPath(sample.sourcePath))
    .rotate()
    .resize({ width: 640, height: 640, fit: "inside" })
    .webp({ quality: 78 })
    .toFile(output);
  const optimizedMetadata = await sharp(output).metadata();
  assert(!optimizedMetadata.exif, "网页优化图已清除 EXIF");
  await unlink(output);

  console.log("\n数据清洗验收通过。");
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
