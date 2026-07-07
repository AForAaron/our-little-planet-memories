import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  DATA_ROOT,
  WORK_ROOT,
  averageHash,
  chineseBigrams,
  fileExists,
  findWechatExport,
  hammingDistance,
  haversineMeters,
  isBlockedAttachment,
  jaccard,
  loadSharp,
  localDateTime,
  localDay,
  parseExif,
  precisionMeters,
  readWorkJson,
  relativeDataPath,
  roundCoordinate,
  sha256File,
  stableHash,
  writeWorkJson,
} from "./shared.mjs";

const PHOTO_ROOT = path.join(DATA_ROOT, "Photos");
const HALF_HOUR_MS = 30 * 60 * 1_000;
const THREE_HOURS_MS = 3 * 60 * 60 * 1_000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1_000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1_000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1_000;
const PHOTO_LINK_WINDOW_MS = 2 * 60 * 60 * 1_000;

const EVENT_KEYWORDS = [
  "第一次",
  "见面",
  "约会",
  "旅行",
  "出发",
  "到达",
  "机场",
  "火车",
  "酒店",
  "民宿",
  "生日",
  "纪念日",
  "礼物",
  "电影",
  "吃饭",
  "餐厅",
  "好吃",
  "拍照",
  "风景",
  "想去",
  "一起",
  "喜欢",
  "爱你",
];

function progress(label, current, total) {
  if (current === 1 || current === total || current % 25 === 0) {
    process.stdout.write(`\r${label} ${current}/${total}`);
    if (current === total) process.stdout.write("\n");
  }
}

async function preparePhotos() {
  const sharp = await loadSharp();
  const names = (await readdir(PHOTO_ROOT))
    .filter((name) => /\.(?:jpe?g|png)$/i.test(name))
    .sort();
  const assets = [];
  const exactHashes = new Map();

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    const absolutePath = path.join(PHOTO_ROOT, name);
    const [metadata, sha256, perceptualHash] = await Promise.all([
      sharp(absolutePath).metadata(),
      sha256File(absolutePath),
      averageHash(sharp, absolutePath),
    ]);
    const exif = parseExif(metadata.exif);
    const capturedAt =
      exif.capturedAt ??
      (() => {
        const match = name.match(/(?:IMG|VID)(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
        if (!match) return null;
        const [, year, month, day, hour, minute, second] = match;
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`).toISOString();
      })();
    const oriented = metadata.autoOrient ?? {
      width: metadata.width,
      height: metadata.height,
    };
    const duplicate = exactHashes.get(sha256) ?? null;
    if (!duplicate) exactHashes.set(sha256, `photo-${sha256.slice(0, 16)}`);
    assets.push({
      id: `photo-${sha256.slice(0, 16)}`,
      sourcePath: relativeDataPath(absolutePath),
      fileName: name,
      sha256,
      perceptualHash,
      exactDuplicateOf: duplicate,
      nearDuplicateOf: null,
      capturedAt,
      width: oriented.width,
      height: oriented.height,
      bytes: (await stat(absolutePath)).size,
      mime: metadata.format === "png" ? "image/png" : "image/jpeg",
      rawLocation:
        exif.latitude == null || exif.longitude == null
          ? null
          : { latitude: exif.latitude, longitude: exif.longitude },
    });
    progress("读取照片", index + 1, names.length);
  }

  for (let current = 0; current < assets.length; current += 1) {
    if (assets[current].exactDuplicateOf) continue;
    for (let previous = Math.max(0, current - 30); previous < current; previous += 1) {
      if (assets[previous].exactDuplicateOf) continue;
      const timeGap = Math.abs(
        new Date(assets[current].capturedAt).getTime() -
          new Date(assets[previous].capturedAt).getTime(),
      );
      if (timeGap > 10 * 60 * 1_000) continue;
      const distance = haversineMeters(
        assets[current].rawLocation,
        assets[previous].rawLocation,
      );
      if (distance > 250) continue;
      if (
        hammingDistance(
          assets[current].perceptualHash,
          assets[previous].perceptualHash,
        ) <= 5
      ) {
        assets[current].nearDuplicateOf = assets[previous].id;
        break;
      }
    }
  }
  return assets;
}

async function prepareAlbumVideos() {
  const names = (await readdir(PHOTO_ROOT))
    .filter((name) => /\.mp4$/i.test(name))
    .sort();
  return Promise.all(
    names.map(async (name) => {
      const absolutePath = path.join(PHOTO_ROOT, name);
      const sha256 = await sha256File(absolutePath);
      const match = name.match(
        /VID(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
      );
      const capturedAt = match
        ? new Date(
            `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`,
          ).toISOString()
        : (await stat(absolutePath)).mtime.toISOString();
      return {
        id: `album-video-${stableHash(sha256)}`,
        sourcePath: relativeDataPath(absolutePath),
        fileName: name,
        sha256,
        capturedAt,
        bytes: (await stat(absolutePath)).size,
        mime: "video/mp4",
      };
    }),
  );
}

function attachAlbumVideos(candidates, videos) {
  for (const video of videos) {
    const closest = candidates
      .map((candidate) => {
        const start = new Date(candidate.startAt).getTime();
        const end = new Date(candidate.endAt).getTime();
        const time = new Date(video.capturedAt).getTime();
        return {
          candidate,
          distance: time < start ? start - time : time > end ? time - end : 0,
        };
      })
      .sort((left, right) => left.distance - right.distance)[0];
    if (!closest || closest.distance > TWELVE_HOURS_MS) continue;
    closest.candidate.mediaPaths.push(video.sourcePath);
    closest.candidate.selectedMediaPaths.push(video.sourcePath);
  }
}

function buildPhotoChapters(photos) {
  const sorted = photos
    .filter((photo) => photo.capturedAt)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const groups = [];
  for (const photo of sorted) {
    const last = groups.at(-1);
    if (
      !last ||
      new Date(photo.capturedAt).getTime() -
        new Date(last.photos.at(-1).capturedAt).getTime() >
        FORTY_EIGHT_HOURS_MS
    ) {
      groups.push({ photos: [photo] });
    } else {
      last.photos.push(photo);
    }
  }
  return groups.map((group) => {
    const startAt = group.photos[0].capturedAt;
    const endAt = group.photos.at(-1).capturedAt;
    const startDay = localDay(startAt);
    const endDay = localDay(endAt);
    return {
      id: `chapter-trip-${startDay}-${stableHash(`${startAt}:${endAt}`)}`,
      kind: "trip",
      title: startDay === endDay ? `${startDay} 的旅程` : `${startDay} 至 ${endDay} 的旅程`,
      summary: "",
      startAt,
      endAt,
      source: "photo_exif",
    };
  });
}

function averageLocation(photos) {
  const located = photos.filter((photo) => photo.rawLocation);
  if (!located.length) return null;
  return {
    latitude:
      located.reduce((total, photo) => total + photo.rawLocation.latitude, 0) /
      located.length,
    longitude:
      located.reduce((total, photo) => total + photo.rawLocation.longitude, 0) /
      located.length,
  };
}

function buildPhotoCandidates(photos, chapters) {
  const candidates = [];
  for (const chapter of chapters.filter((item) => item.kind === "trip")) {
    const chapterPhotos = photos
      .filter(
        (photo) =>
          photo.capturedAt >= chapter.startAt && photo.capturedAt <= chapter.endAt,
      )
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    const clusters = [];
    for (const photo of chapterPhotos) {
      const last = clusters.at(-1);
      const center = last ? averageLocation(last.photos) : null;
      const timeGap = last
        ? new Date(photo.capturedAt).getTime() -
          new Date(last.photos.at(-1).capturedAt).getTime()
        : Number.POSITIVE_INFINITY;
      if (
        !last ||
        timeGap > TWELVE_HOURS_MS ||
        haversineMeters(center, photo.rawLocation) > 250
      ) {
        clusters.push({ photos: [photo] });
      } else {
        last.photos.push(photo);
      }
    }

    for (const cluster of clusters) {
      const first = cluster.photos[0];
      const last = cluster.photos.at(-1);
      const exactLocation = averageLocation(cluster.photos);
      const privacyLevel = "approximate";
      const id = `photo-event-${stableHash(
        cluster.photos.map((photo) => photo.sha256).join(":"),
      )}`;
      candidates.push({
        id,
        sourceType: "photo",
        sourceRef: id,
        chapterId: chapter.id,
        title: `${localDateTime(first.capturedAt)} 的照片记忆`,
        summary: "",
        category: "trip",
        startAt: first.capturedAt,
        endAt: last.capturedAt,
        score: 5,
        classification: "event",
        status: "draft",
        messageIds: [],
        selectedMessageIds: [],
        mediaPaths: cluster.photos.map((photo) => photo.sourcePath),
        selectedMediaPaths: cluster.photos
          .filter((photo) => !photo.exactDuplicateOf && !photo.nearDuplicateOf)
          .map((photo) => photo.sourcePath),
        coverPath:
          cluster.photos.find(
            (photo) => !photo.exactDuplicateOf && !photo.nearDuplicateOf,
          )?.sourcePath ?? first.sourcePath,
        placeName: "",
        privacyLevel,
        precisionM: precisionMeters(privacyLevel),
        location: exactLocation
          ? {
              latitude: roundCoordinate(exactLocation.latitude, privacyLevel),
              longitude: roundCoordinate(exactLocation.longitude, privacyLevel),
            }
          : null,
        rawLocation: exactLocation,
        createdFrom: "photo_cluster",
      });
    }
  }
  return candidates;
}

function normalizeMessage(message, exportDirectory) {
  const absoluteMedia = (message.offlineMedia ?? []).map((item) => {
    const absolute = path.join(exportDirectory, item.path);
    return {
      kind: item.kind,
      sourcePath: relativeDataPath(absolute),
      exists: true,
      blocked: isBlockedAttachment(item.path),
    };
  });
  return {
    id: String(message.id),
    localId: Number(message.localId),
    // serverId is deliberately omitted: most values exceed Number.MAX_SAFE_INTEGER.
    sentAt: new Date(Number(message.createTime) * 1_000).toISOString(),
    sortSeq: String(message.sortSeq),
    senderRole:
      message.renderType === "system" ? "system" : message.isSent ? "self" : "partner",
    senderDisplayName: String(message.senderDisplayName ?? ""),
    renderType: String(message.renderType ?? "unknown"),
    content: String(message.content ?? ""),
    quote: message.quoteServerId
      ? {
          sourceServerId: String(message.quoteServerId),
          title: String(message.quoteTitle ?? ""),
          content: String(message.quoteContent ?? ""),
        }
      : null,
    voiceDurationMs: message.voiceLength
      ? Number.parseInt(String(message.voiceLength), 10)
      : null,
    media: absoluteMedia,
  };
}

function topicText(messages) {
  return messages
    .filter((message) => !["system", "emoji"].includes(message.renderType))
    .map((message) => `${message.content} ${message.quote?.content ?? ""}`)
    .join(" ");
}

function keywordsFor(messages) {
  const text = topicText(messages);
  return EVENT_KEYWORDS.filter((keyword) => text.includes(keyword));
}

function scoreMessages(messages, linkedPhotos) {
  const meaningful = messages.filter(
    (message) =>
      !["system", "emoji"].includes(message.renderType) &&
      message.content.replace(/\[[^\]]+\]/g, "").trim().length > 0,
  );
  const hasMedia = messages.some((message) =>
    message.media.some((media) => !media.blocked),
  );
  const speakers = new Set(
    messages
      .map((message) => message.senderRole)
      .filter((role) => role === "self" || role === "partner"),
  );
  const keywords = keywordsFor(messages);
  let score = 0;
  if (hasMedia) score += 3;
  if (speakers.size === 2) score += 2;
  if (meaningful.length >= 20) score += 2;
  if (keywords.length) score += 2;
  if (linkedPhotos.length) score += 3;
  const duration =
    new Date(messages.at(-1).sentAt).getTime() -
    new Date(messages[0].sentAt).getTime();
  if (duration >= 10 * 60 * 1_000 && duration <= 3 * 60 * 60 * 1_000) score += 1;
  return { score, keywords, meaningfulCount: meaningful.length };
}

function segmentMessages(messages) {
  const segments = [];
  let current = [];
  for (const message of messages) {
    const previous = current.at(-1);
    const gap = previous
      ? new Date(message.sentAt).getTime() - new Date(previous.sentAt).getTime()
      : 0;
    const currentDuration = current[0]
      ? new Date(message.sentAt).getTime() - new Date(current[0].sentAt).getTime()
      : 0;
    if (
      previous &&
      (gap > HALF_HOUR_MS ||
        localDay(previous.sentAt) !== localDay(message.sentAt) ||
        currentDuration > THREE_HOURS_MS ||
        current.length >= 300)
    ) {
      segments.push(current);
      current = [];
    }
    current.push(message);
  }
  if (current.length) segments.push(current);
  return segments.map((items) => ({
    id: `segment-${stableHash(`${items[0].id}:${items.at(-1).id}`)}`,
    startAt: items[0].sentAt,
    endAt: items.at(-1).sentAt,
    messageIds: items.map((item) => item.id),
    text: topicText(items),
    keywords: keywordsFor(items),
    mediaCount: items.flatMap((item) => item.media).filter((item) => !item.blocked)
      .length,
  }));
}

function linkPhotos(startAt, endAt, photos) {
  const start = new Date(startAt).getTime() - PHOTO_LINK_WINDOW_MS;
  const end = new Date(endAt).getTime() + PHOTO_LINK_WINDOW_MS;
  return photos.filter((photo) => {
    const timestamp = new Date(photo.capturedAt).getTime();
    return timestamp >= start && timestamp <= end;
  });
}

function mergeSegments(segments, messageById, photos) {
  const groups = [];
  for (const segment of segments) {
    const last = groups.at(-1);
    if (!last) {
      groups.push({ segments: [segment] });
      continue;
    }
    const previous = last.segments.at(-1);
    const gap =
      new Date(segment.startAt).getTime() - new Date(previous.endAt).getTime();
    const sharedKeyword = segment.keywords.some((keyword) =>
      previous.keywords.includes(keyword),
    );
    const similarity = jaccard(
      chineseBigrams(previous.text),
      chineseBigrams(segment.text),
    );
    const bothHaveMedia = previous.mediaCount > 0 && segment.mediaCount > 0;
    const nearbyPhotos = linkPhotos(previous.endAt, segment.startAt, photos).length > 0;
    const mergedDuration =
      new Date(segment.endAt).getTime() -
      new Date(last.segments[0].startAt).getTime();
    const mergedMessages =
      last.segments.reduce((total, item) => total + item.messageIds.length, 0) +
      segment.messageIds.length;
    if (
      localDay(previous.startAt) === localDay(segment.startAt) &&
      gap <= FOUR_HOURS_MS &&
      mergedDuration <= FOUR_HOURS_MS &&
      mergedMessages <= 400 &&
      (sharedKeyword || similarity >= 0.08 || bothHaveMedia || nearbyPhotos)
    ) {
      last.segments.push(segment);
    } else {
      groups.push({ segments: [segment] });
    }
  }

  return groups.map((group) => {
    const messageIds = group.segments.flatMap((segment) => segment.messageIds);
    const messages = messageIds.map((id) => messageById.get(id));
    const linkedPhotos = linkPhotos(messages[0].sentAt, messages.at(-1).sentAt, photos);
    const scoring = scoreMessages(messages, linkedPhotos);
    const id = `wechat-event-${stableHash(
      `${messages[0].id}:${messages.at(-1).id}`,
    )}`;
    const mediaPaths = [
      ...messages.flatMap((message) =>
        message.media
          .filter((media) => media.exists && !media.blocked)
          .map((media) => media.sourcePath),
      ),
      ...linkedPhotos.map((photo) => photo.sourcePath),
    ].filter((value, index, all) => all.indexOf(value) === index);
    return {
      id,
      sourceType: linkedPhotos.length ? "mixed" : "chat",
      sourceRef: id,
      chapterId: "",
      title: `${localDateTime(messages[0].sentAt)} 的聊天记忆`,
      summary: "",
      category: "moment",
      startAt: messages[0].sentAt,
      endAt: messages.at(-1).sentAt,
      score: scoring.score,
      classification: scoring.score >= 4 ? "event" : "unclassified",
      status: "draft",
      messageIds,
      selectedMessageIds: messageIds,
      mediaPaths,
      selectedMediaPaths: mediaPaths,
      coverPath:
        mediaPaths.find((mediaPath) => /\.(?:jpe?g|png)$/i.test(mediaPath)) ?? null,
      placeName: "",
      privacyLevel: "approximate",
      precisionM: 100,
      location: null,
      rawLocation: null,
      keywords: scoring.keywords,
      meaningfulMessageCount: scoring.meaningfulCount,
      createdFrom: "chat_segments",
    };
  });
}

function buildDailyChapters(candidates, photoChapters) {
  const photoChapterByDay = new Map();
  for (const chapter of photoChapters) {
    let cursor = new Date(`${localDay(chapter.startAt)}T00:00:00+08:00`);
    const endDay = localDay(chapter.endAt);
    while (localDay(cursor.toISOString()) <= endDay) {
      photoChapterByDay.set(localDay(cursor.toISOString()), chapter.id);
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1_000);
    }
  }
  const daily = new Map();
  for (const candidate of candidates) {
    const day = localDay(candidate.startAt);
    const tripChapter = photoChapterByDay.get(day);
    if (tripChapter) {
      candidate.chapterId = tripChapter;
      continue;
    }
    const id = `chapter-day-${day}`;
    if (!daily.has(id)) {
      daily.set(id, {
        id,
        kind: "day",
        title: `${day} 的日常`,
        summary: "",
        startAt: candidate.startAt,
        endAt: candidate.endAt,
        source: "wechat",
      });
    } else {
      const chapter = daily.get(id);
      if (candidate.startAt < chapter.startAt) chapter.startAt = candidate.startAt;
      if (candidate.endAt > chapter.endAt) chapter.endAt = candidate.endAt;
    }
    candidate.chapterId = id;
  }
  return [...daily.values()];
}

const REVIEW_FIELDS = [
  "chapterId",
  "title",
  "summary",
  "category",
  "startAt",
  "endAt",
  "status",
  "selectedMessageIds",
  "selectedMediaPaths",
  "coverPath",
  "placeName",
  "privacyLevel",
  "precisionM",
  "location",
  "reviewNotes",
];

function reviewOverride(candidate) {
  return Object.fromEntries(
    REVIEW_FIELDS.map((field) => [field, candidate[field] ?? null]),
  );
}

function reviewStateFromCandidates(candidates) {
  const reviewed = candidates.filter(
    (candidate) =>
      candidate.status !== "draft" ||
      candidate.reviewNotes ||
      ["manual_merge", "manual_split", "manual_photo_split"].includes(
        candidate.createdFrom,
      ),
  );
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    bySourceRef: Object.fromEntries(
      reviewed.map((candidate) => [
        candidate.sourceRef,
        reviewOverride(candidate),
      ]),
    ),
    manualCandidates: reviewed.filter((candidate) =>
      ["manual_merge", "manual_split", "manual_photo_split"].includes(
        candidate.createdFrom,
      ),
    ),
  };
}

function applyReviewState(generated, state) {
  if (!state?.bySourceRef) return generated;
  const preserved = generated.map((candidate) => {
    const saved = state.bySourceRef[candidate.sourceRef];
    if (!saved) return candidate;
    const merged = {
      ...candidate,
      ...Object.fromEntries(
        REVIEW_FIELDS.filter((field) => saved[field] != null).map((field) => [
          field,
          saved[field],
        ]),
      ),
    };
    merged.selectedMessageIds = merged.selectedMessageIds.filter((id) =>
      merged.messageIds.includes(id),
    );
    merged.selectedMediaPaths = merged.selectedMediaPaths.filter((sourcePath) =>
      merged.mediaPaths.includes(sourcePath),
    );
    if (
      merged.coverPath &&
      !merged.selectedMediaPaths.includes(merged.coverPath)
    ) {
      merged.coverPath = merged.selectedMediaPaths[0] ?? null;
    }
    return merged;
  });
  const manual = state.manualCandidates ?? [];
  const replacedIds = new Set(manual.flatMap((candidate) => candidate.replaces ?? []));
  return [
    ...preserved.filter((candidate) => !replacedIds.has(candidate.id)),
    ...manual,
  ].sort((left, right) => left.startAt.localeCompare(right.startAt));
}

async function main() {
  console.log(`中间产物目录：${WORK_ROOT}`);
  const { directory: exportDirectory, manifest } = await findWechatExport();
  console.log(`使用微信导出：${path.basename(exportDirectory)}`);

  const [photos, albumVideos] = await Promise.all([
    preparePhotos(),
    prepareAlbumVideos(),
  ]);
  const photoChapters = buildPhotoChapters(photos);
  const photoCandidates = buildPhotoCandidates(photos, photoChapters);
  attachAlbumVideos(photoCandidates, albumVideos);

  const conversationRoot = path.join(exportDirectory, "conversations");
  const conversationDirectory = (await readdir(conversationRoot, { withFileTypes: true }))
    .find((entry) => entry.isDirectory());
  if (!conversationDirectory) throw new Error("微信导出中没有会话目录。");
  const messagesFile = path.join(
    conversationRoot,
    conversationDirectory.name,
    "messages.json",
  );
  const raw = JSON.parse(await readFile(messagesFile, "utf8"));
  const messages = raw.messages
    .map((message) => normalizeMessage(message, exportDirectory))
    .sort(
      (left, right) =>
        new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime() ||
        left.localId - right.localId,
    );
  for (const message of messages) {
    for (const media of message.media) {
      media.exists = await fileExists(path.join(DATA_ROOT, media.sourcePath));
    }
  }

  const baseSegments = segmentMessages(messages);
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const chatCandidates = mergeSegments(baseSegments, messageById, photos);
  const dailyChapters = buildDailyChapters(chatCandidates, photoChapters);
  const chapters = [...photoChapters, ...dailyChapters].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  );
  const previousCandidates = await readWorkJson("candidates.json", []);
  let reviewState = await readWorkJson("review-state.json", null);
  if (!reviewState && previousCandidates.length) {
    reviewState = reviewStateFromCandidates(previousCandidates);
    await writeWorkJson("review-state.json", reviewState);
  }
  const candidates = applyReviewState(
    [...photoCandidates, ...chatCandidates].sort((a, b) =>
      a.startAt.localeCompare(b.startAt),
    ),
    reviewState,
  );
  const referencedMedia = new Set(
    messages.flatMap((message) => message.media.map((media) => media.sourcePath)),
  );
  const missingMedia = messages
    .flatMap((message) => message.media)
    .filter((media) => !media.exists).length;

  const stats = {
    generatedAt: new Date().toISOString(),
    sourceExportId: manifest.exportId,
    photos: {
      count: photos.length,
      withGps: photos.filter((photo) => photo.rawLocation).length,
      exactDuplicates: photos.filter((photo) => photo.exactDuplicateOf).length,
      nearDuplicates: photos.filter((photo) => photo.nearDuplicateOf).length,
      chapters: photoChapters.length,
      eventCandidates: photoCandidates.length,
      albumVideos: albumVideos.length,
    },
    chat: {
      messages: messages.length,
      baseSegments: baseSegments.length,
      eventCandidates: chatCandidates.length,
      classifiedEvents: chatCandidates.filter(
        (candidate) => candidate.classification === "event",
      ).length,
      unclassified: chatCandidates.filter(
        (candidate) => candidate.classification === "unclassified",
      ).length,
      referencedMedia: referencedMedia.size,
      missingOfflineMedia: missingMedia,
      blockedAttachments: messages
        .flatMap((message) => message.media)
        .filter((media) => media.blocked).length,
    },
    review: {
      approved: candidates.filter((candidate) => candidate.status === "approved").length,
      rejected: candidates.filter((candidate) => candidate.status === "rejected").length,
      draft: candidates.filter((candidate) => candidate.status === "draft").length,
    },
  };

  await writeWorkJson("photos.json", photos);
  await writeWorkJson("album-videos.json", albumVideos);
  await writeWorkJson("messages.json", messages);
  await writeWorkJson("segments.json", baseSegments);
  await writeWorkJson("chapters.json", chapters);
  await writeWorkJson("candidates.json", candidates);
  await writeWorkJson(
    "review-state.json",
    reviewState ?? reviewStateFromCandidates(candidates),
  );
  await writeWorkJson("stats.json", stats);
  await writeWorkJson("manifest.json", {
    schemaVersion: 1,
    generatedAt: stats.generatedAt,
    source: {
      exportId: manifest.exportId,
      exportDirectory: relativeDataPath(exportDirectory),
      photosDirectory: relativeDataPath(PHOTO_ROOT),
    },
    files: [
      "photos.json",
      "album-videos.json",
      "messages.json",
      "segments.json",
      "chapters.json",
      "candidates.json",
      "review-state.json",
      "stats.json",
    ],
  });

  console.log(JSON.stringify(stats, null, 2));
  console.log("\n下一步：运行 `pnpm review`，打开 http://127.0.0.1:3000/import-review");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
