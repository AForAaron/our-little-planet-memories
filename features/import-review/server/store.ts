import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getImportRoots } from "./paths";
import type {
  CandidateDetail,
  CandidatePatch,
  Chapter,
  NormalizedMessage,
  PhotoAsset,
  PrivacyLevel,
  ReviewCandidate,
  ReviewOverview,
} from "../types";

let messageCache:
  | { modified: number; value: NormalizedMessage[]; byId: Map<string, NormalizedMessage> }
  | undefined;
let photoCache:
  | { modified: number; value: PhotoAsset[]; byPath: Map<string, PhotoAsset> }
  | undefined;

function workPath(name: string) {
  return path.join(getImportRoots().workRoot, name);
}

async function readJson<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(workPath(name), "utf8")) as T;
}

async function readPublishJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(
      await readFile(path.join(getImportRoots().publishRoot, name), "utf8"),
    ) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(name: string, value: unknown) {
  const { workRoot } = getImportRoots();
  await mkdir(workRoot, { recursive: true });
  const destination = workPath(name);
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, destination);
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
  "revision",
  "reviewedBy",
  "reviewedAt",
  "lastEditedBy",
  "lastEditedAt",
] as const;

export const REVIEW_ACCESS_COOKIE = "little_planet_review";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function reviewAccessDigest() {
  const token = process.env.REVIEW_ACCESS_TOKEN?.trim();
  return token ? digest(token) : "";
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function reviewAccessCookieValue(token: string) {
  return digest(token.trim());
}

export function validateReviewAccessToken(token: string) {
  const expected = reviewAccessDigest();
  if (!expected || !token.trim()) return false;
  return safeEqual(reviewAccessCookieValue(token), expected);
}

export function getReviewActor(request: Request) {
  const raw = request.headers.get("x-reviewer-label")?.trim() || "";
  try {
    return decodeURIComponent(raw).slice(0, 24) || "我";
  } catch {
    return raw.slice(0, 24) || "我";
  }
}

function requestHasValidReviewCookie(request: Request) {
  const expected = reviewAccessDigest();
  const actual = cookieValue(request, REVIEW_ACCESS_COOKIE);
  if (!expected || !actual) return false;
  return safeEqual(actual, expected);
}

type ReviewState = {
  schemaVersion: number;
  updatedAt: string;
  bySourceRef: Record<string, Record<string, unknown>>;
  manualCandidates: ReviewCandidate[];
};

function reviewOverride(candidate: ReviewCandidate) {
  return Object.fromEntries(
    REVIEW_FIELDS.map((field) => [field, candidate[field] ?? null]),
  );
}

async function updateReviewState(
  candidates: ReviewCandidate[],
  touchedSourceRefs: string[],
) {
  let previous: ReviewState = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    bySourceRef: {},
    manualCandidates: [],
  };
  try {
    previous = await readJson<ReviewState>("review-state.json");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  for (const sourceRef of touchedSourceRefs) {
    const candidate = candidates.find((item) => item.sourceRef === sourceRef);
    if (candidate) {
      previous.bySourceRef[sourceRef] = reviewOverride(candidate);
    } else {
      delete previous.bySourceRef[sourceRef];
    }
  }

  const manualCandidates = candidates.filter((candidate) =>
    ["manual_merge", "manual_split", "manual_photo_split"].includes(
      candidate.createdFrom,
    ),
  );
  const manualRefs = new Set(manualCandidates.map((item) => item.sourceRef));
  previous.manualCandidates = manualCandidates;
  for (const sourceRef of Object.keys(previous.bySourceRef)) {
    if (
      sourceRef.startsWith("manual-") &&
      !manualRefs.has(sourceRef)
    ) {
      delete previous.bySourceRef[sourceRef];
    }
  }
  previous.updatedAt = new Date().toISOString();
  await writeJson("review-state.json", previous);
}

async function loadMessages() {
  const file = workPath("messages.json");
  const info = await stat(file);
  if (!messageCache || messageCache.modified !== info.mtimeMs) {
    const value = await readJson<NormalizedMessage[]>("messages.json");
    messageCache = {
      modified: info.mtimeMs,
      value,
      byId: new Map(value.map((message) => [message.id, message])),
    };
  }
  return messageCache;
}

async function loadPhotos() {
  const file = workPath("photos.json");
  const info = await stat(file);
  if (!photoCache || photoCache.modified !== info.mtimeMs) {
    const value = await readJson<PhotoAsset[]>("photos.json");
    photoCache = {
      modified: info.mtimeMs,
      value,
      byPath: new Map(value.map((photo) => [photo.sourcePath, photo])),
    };
  }
  return photoCache;
}

function rounded(value: number, privacyLevel: PrivacyLevel) {
  const decimals = privacyLevel === "exact" ? 6 : privacyLevel === "private" ? 2 : 3;
  return Number(value.toFixed(decimals));
}

function precision(privacyLevel: PrivacyLevel) {
  return privacyLevel === "exact" ? 5 : privacyLevel === "private" ? 1_000 : 100;
}

function applyPrivacy(candidate: ReviewCandidate) {
  if (!candidate.rawLocation) {
    candidate.location = null;
    candidate.precisionM = precision(candidate.privacyLevel);
    return;
  }
  candidate.location = {
    latitude: rounded(candidate.rawLocation.latitude, candidate.privacyLevel),
    longitude: rounded(candidate.rawLocation.longitude, candidate.privacyLevel),
  };
  candidate.precisionM = precision(candidate.privacyLevel);
}

async function saveCandidates(
  candidates: ReviewCandidate[],
  touchedSourceRefs: string[],
) {
  candidates.sort((left, right) => left.startAt.localeCompare(right.startAt));
  await writeJson("candidates.json", candidates);
  await updateReviewState(candidates, touchedSourceRefs);
  await writeJson(
    "approved-events.json",
    candidates.filter((candidate) => candidate.status === "approved"),
  );
}

export function reviewModeEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.IMPORT_REVIEW_MODE === "1"
  );
}

export function requestIsLocal(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (!["127.0.0.1", "::1", "localhost"].includes(originHost)) return false;
    } catch {
      return false;
    }
  }
  const forwardedFor = request.headers.get("x-forwarded-for");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return false;
  if (
    forwardedFor &&
    !forwardedFor
      .split(",")
      .map((value) => value.trim())
      .every((value) =>
        ["127.0.0.1", "::1", "localhost"].includes(value),
      )
  ) {
    return false;
  }
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}

export function canUseReview(request?: Request) {
  return (
    reviewModeEnabled() &&
    (!request || requestIsLocal(request) || requestHasValidReviewCookie(request))
  );
}

export function normalizeCandidate(candidate: ReviewCandidate) {
  candidate.revision ??= 0;
  candidate.reviewedBy ??= null;
  candidate.reviewedAt ??= null;
  candidate.lastEditedBy ??= null;
  candidate.lastEditedAt ??= null;
  return candidate;
}

export class ReviewConflictError extends Error {
  constructor() {
    super("这条候选已被对方更新，请刷新后再保存。");
    this.name = "ReviewConflictError";
  }
}

type PublicationManifest = {
  events?: Record<
    string,
    {
      status?: string;
      entryId?: string;
      publishedAt?: string;
    }
  >;
};

export async function getOverview(): Promise<ReviewOverview> {
  const [stats, chapters, candidates, publicationManifest] = await Promise.all([
    readJson<Record<string, unknown>>("stats.json"),
    readJson<Chapter[]>("chapters.json"),
    readJson<ReviewCandidate[]>("candidates.json"),
    readPublishJson<PublicationManifest>("publication-manifest.json", { events: {} }),
  ]);
  const publishedEvents = publicationManifest.events ?? {};
  return {
    stats,
    chapters,
    candidates: candidates.map(normalizeCandidate).map(
      ({
        messageIds,
        selectedMessageIds,
        mediaPaths,
        selectedMediaPaths,
        ...candidate
      }) => ({
        ...candidate,
        publicationStatus:
          publishedEvents[candidate.id]?.status === "published"
            ? "published"
            : "pending",
        publishedEntryId: publishedEvents[candidate.id]?.entryId ?? null,
        publishedAt: publishedEvents[candidate.id]?.publishedAt ?? null,
        messageCount: messageIds.length,
        selectedMessageCount: selectedMessageIds.length,
        mediaCount: mediaPaths.length,
        selectedMediaCount: selectedMediaPaths.length,
      }),
    ),
  };
}

export async function getCandidate(id: string): Promise<CandidateDetail | null> {
  const candidates = await readJson<ReviewCandidate[]>("candidates.json");
  const candidate = candidates.map(normalizeCandidate).find((item) => item.id === id);
  if (!candidate) return null;
  const [messages, photos] = await Promise.all([loadMessages(), loadPhotos()]);
  return {
    candidate,
    messages: candidate.messageIds
      .map((messageId) => messages.byId.get(messageId))
      .filter((message): message is NormalizedMessage => Boolean(message)),
    photos: candidate.mediaPaths
      .map((sourcePath) => photos.byPath.get(sourcePath))
      .filter((photo): photo is PhotoAsset => Boolean(photo)),
  };
}

export async function updateCandidate(
  id: string,
  patch: CandidatePatch,
  editor = "我",
) {
  const candidates = await readJson<ReviewCandidate[]>("candidates.json");
  candidates.forEach(normalizeCandidate);
  const candidate = candidates.find((item) => item.id === id);
  if (!candidate) return null;
  if (patch.revision !== undefined && patch.revision !== candidate.revision) {
    throw new ReviewConflictError();
  }
  const previousStatus = candidate.status;
  const allowed: (keyof CandidatePatch)[] = [
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
    "reviewNotes",
  ];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      Object.assign(candidate, { [key]: patch[key] });
    }
  }
  candidate.selectedMessageIds = candidate.selectedMessageIds.filter((messageId) =>
    candidate.messageIds.includes(messageId),
  );
  candidate.selectedMediaPaths = candidate.selectedMediaPaths.filter((sourcePath) =>
    candidate.mediaPaths.includes(sourcePath),
  );
  if (
    candidate.coverPath &&
    !candidate.selectedMediaPaths.includes(candidate.coverPath)
  ) {
    candidate.coverPath = candidate.selectedMediaPaths[0] ?? null;
  }
  applyPrivacy(candidate);
  const now = new Date().toISOString();
  candidate.revision = (candidate.revision ?? 0) + 1;
  candidate.lastEditedBy = editor;
  candidate.lastEditedAt = now;
  if (
    candidate.status !== "draft" &&
    (candidate.status !== previousStatus || !candidate.reviewedAt)
  ) {
    candidate.reviewedBy = editor;
    candidate.reviewedAt = now;
  }
  await saveCandidates(candidates, [candidate.sourceRef]);
  return candidate;
}

export async function mergeCandidates(ids: string[], editor = "我") {
  const candidates = await readJson<ReviewCandidate[]>("candidates.json");
  const selected = candidates
    .filter((candidate) => ids.includes(candidate.id))
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
  if (selected.length < 2) throw new Error("至少选择两个事件才能合并。");
  const digest = createHash("sha256").update(selected.map((item) => item.id).join(":")).digest("hex");
  const first = selected[0];
  const merged: ReviewCandidate = {
    ...first,
    id: `manual-merge-${digest.slice(0, 16)}`,
    sourceRef: `manual-merge-${digest.slice(0, 16)}`,
    title: first.title,
    summary: selected.map((candidate) => candidate.summary).filter(Boolean).join("\n\n"),
    startAt: first.startAt,
    endAt: selected.at(-1)!.endAt,
    score: Math.max(...selected.map((candidate) => candidate.score)),
    status: "draft",
    messageIds: [...new Set(selected.flatMap((candidate) => candidate.messageIds))],
    selectedMessageIds: [
      ...new Set(selected.flatMap((candidate) => candidate.selectedMessageIds)),
    ],
    mediaPaths: [...new Set(selected.flatMap((candidate) => candidate.mediaPaths))],
    selectedMediaPaths: [
      ...new Set(selected.flatMap((candidate) => candidate.selectedMediaPaths)),
    ],
    createdFrom: "manual_merge",
    replaces: [
      ...new Set(
        selected.flatMap((candidate) => candidate.replaces ?? [candidate.id]),
      ),
    ],
    revision: 0,
    reviewedBy: null,
    reviewedAt: null,
    lastEditedBy: editor,
    lastEditedAt: new Date().toISOString(),
  };
  const retained = candidates.filter((candidate) => !ids.includes(candidate.id));
  retained.push(merged);
  await saveCandidates(retained, [
    ...selected.map((candidate) => candidate.sourceRef),
    merged.sourceRef,
  ]);
  return merged;
}

export async function splitCandidate(
  id: string,
  splitMessageId: string,
  editor = "我",
) {
  const candidates = await readJson<ReviewCandidate[]>("candidates.json");
  const original = candidates.find((candidate) => candidate.id === id);
  if (!original) throw new Error("没有找到要拆分的事件。");
  const splitIndex = original.messageIds.indexOf(splitMessageId);
  if (splitIndex <= 0 || splitIndex >= original.messageIds.length) {
    throw new Error("拆分点必须位于事件消息中间。");
  }
  const [messages, photos] = await Promise.all([loadMessages(), loadPhotos()]);
  const messageMediaPaths = new Set(
    original.messageIds.flatMap(
      (messageId) =>
        messages.byId.get(messageId)?.media.map((media) => media.sourcePath) ?? [],
    ),
  );
  const standalonePhotoPaths = original.mediaPaths.filter(
    (sourcePath) => !messageMediaPaths.has(sourcePath),
  );
  const halves = [
    original.messageIds.slice(0, splitIndex),
    original.messageIds.slice(splitIndex),
  ];
  const split = halves.map((messageIds, index): ReviewCandidate => {
    const firstMessage = messages.byId.get(messageIds[0])!;
    const lastMessage = messages.byId.get(messageIds.at(-1)!)!;
    const directMedia = messageIds.flatMap(
      (messageId) =>
        messages.byId.get(messageId)?.media.map((media) => media.sourcePath) ?? [],
    );
    const nearestStandalone = standalonePhotoPaths.filter((sourcePath) => {
      const photo = photos.byPath.get(sourcePath);
      if (!photo) return index === 0;
      const distances = halves.map((half) => {
        const first = messages.byId.get(half[0])!;
        const last = messages.byId.get(half.at(-1)!)!;
        const center =
          (new Date(first.sentAt).getTime() + new Date(last.sentAt).getTime()) / 2;
        return Math.abs(new Date(photo.capturedAt).getTime() - center);
      });
      return distances[index] <= distances[1 - index];
    });
    const mediaPaths = [...new Set([...directMedia, ...nearestStandalone])];
    const newId = `manual-split-${createHash("sha256")
      .update(`${original.id}:${index}:${messageIds[0]}`)
      .digest("hex")
      .slice(0, 16)}`;
    return {
      ...original,
      id: newId,
      sourceRef: newId,
      title: `${original.title}（${index + 1}）`,
      startAt: firstMessage.sentAt,
      endAt: lastMessage.sentAt,
      status: "draft",
      messageIds,
      selectedMessageIds: original.selectedMessageIds.filter((messageId) =>
        messageIds.includes(messageId),
      ),
      mediaPaths,
      selectedMediaPaths: original.selectedMediaPaths.filter((sourcePath) =>
        mediaPaths.includes(sourcePath),
      ),
      coverPath:
        original.coverPath && mediaPaths.includes(original.coverPath)
          ? original.coverPath
          : mediaPaths[0] ?? null,
      createdFrom: "manual_split",
      replaces: original.replaces ?? [original.id],
      revision: 0,
      reviewedBy: null,
      reviewedAt: null,
      lastEditedBy: editor,
      lastEditedAt: new Date().toISOString(),
    };
  });
  const retained = candidates.filter((candidate) => candidate.id !== original.id);
  retained.push(...split);
  await saveCandidates(retained, [
    original.sourceRef,
    ...split.map((candidate) => candidate.sourceRef),
  ]);
  return split;
}

export async function splitPhotoCandidate(
  id: string,
  splitPhotoPath: string,
  editor = "我",
) {
  const candidates = await readJson<ReviewCandidate[]>("candidates.json");
  const original = candidates.find((candidate) => candidate.id === id);
  if (!original || original.sourceType !== "photo") {
    throw new Error("只能拆分纯照片事件。");
  }
  const splitIndex = original.mediaPaths.indexOf(splitPhotoPath);
  if (splitIndex <= 0 || splitIndex >= original.mediaPaths.length) {
    throw new Error("拆分点必须位于照片组中间。");
  }
  const photos = await loadPhotos();
  const halves = [
    original.mediaPaths.slice(0, splitIndex),
    original.mediaPaths.slice(splitIndex),
  ];
  const split = halves.map((mediaPaths, index): ReviewCandidate => {
    const assets = mediaPaths
      .map((sourcePath) => photos.byPath.get(sourcePath))
      .filter((photo): photo is PhotoAsset => Boolean(photo));
    const located = assets.filter((photo) => photo.rawLocation);
    const rawLocation = located.length
      ? {
          latitude:
            located.reduce(
              (total, photo) => total + photo.rawLocation!.latitude,
              0,
            ) / located.length,
          longitude:
            located.reduce(
              (total, photo) => total + photo.rawLocation!.longitude,
              0,
            ) / located.length,
        }
      : null;
    const sourceRef = `manual-photo-split-${createHash("sha256")
      .update(`${original.sourceRef}:${index}:${mediaPaths[0]}`)
      .digest("hex")
      .slice(0, 16)}`;
    const selectedMediaPaths = original.selectedMediaPaths.filter((path) =>
      mediaPaths.includes(path),
    );
    return {
      ...original,
      id: sourceRef,
      sourceRef,
      title: `${original.title}（${index + 1}）`,
      startAt: assets[0]?.capturedAt ?? original.startAt,
      endAt: assets.at(-1)?.capturedAt ?? original.endAt,
      status: "draft",
      mediaPaths,
      selectedMediaPaths,
      coverPath:
        original.coverPath && selectedMediaPaths.includes(original.coverPath)
          ? original.coverPath
          : selectedMediaPaths[0] ?? mediaPaths[0] ?? null,
      rawLocation,
      createdFrom: "manual_photo_split",
      replaces: original.replaces ?? [original.id],
      revision: 0,
      reviewedBy: null,
      reviewedAt: null,
      lastEditedBy: editor,
      lastEditedAt: new Date().toISOString(),
    };
  });
  split.forEach(applyPrivacy);
  const retained = candidates.filter((candidate) => candidate.id !== original.id);
  retained.push(...split);
  await saveCandidates(retained, [
    original.sourceRef,
    ...split.map((candidate) => candidate.sourceRef),
  ]);
  return split;
}

export async function dryRunSummary() {
  const [candidates, chapters, photos, albumVideos, messages] = await Promise.all([
    readJson<ReviewCandidate[]>("candidates.json"),
    readJson<Chapter[]>("chapters.json"),
    loadPhotos(),
    readJson<{ sourcePath: string; bytes: number }[]>("album-videos.json"),
    loadMessages(),
  ]);
  const approved = candidates.filter((candidate) => candidate.status === "approved");
  const approvedChapterIds = new Set(approved.map((candidate) => candidate.chapterId));
  const selectedPaths = new Set(
    approved.flatMap((candidate) => candidate.selectedMediaPaths),
  );
  const bytesByPath = new Map([
    ...photos.value.map((photo) => [photo.sourcePath, photo.bytes] as const),
    ...albumVideos.map((video) => [video.sourcePath, video.bytes] as const),
  ]);
  const { dataRoot } = getImportRoots();
  const selectedBytes = await Promise.all(
    [...selectedPaths].map(async (sourcePath) => {
      const known = bytesByPath.get(sourcePath);
      if (known != null) return known;
      const resolved = path.resolve(dataRoot, sourcePath);
      if (
        resolved !== dataRoot &&
        !resolved.startsWith(`${dataRoot}${path.sep}`)
      ) {
        return 0;
      }
      try {
        return (await stat(resolved)).size;
      } catch {
        return 0;
      }
    }),
  );
  const photoBytes = selectedBytes.reduce((total, bytes) => total + bytes, 0);
  const selectedMessageIds = new Set(
    approved.flatMap((candidate) => candidate.selectedMessageIds),
  );
  const voiceCount = [...selectedMessageIds]
    .map((id) => messages.byId.get(id))
    .filter((message) => message?.renderType === "voice").length;
  return {
    generatedAt: new Date().toISOString(),
    chapters: chapters.filter((chapter) => approvedChapterIds.has(chapter.id)).length,
    events: approved.length,
    messages: selectedMessageIds.size,
    media: selectedPaths.size,
    originalMediaBytes: photoBytes,
    originalMediaMiB: Number((photoBytes / 1024 / 1024).toFixed(1)),
    voiceMessages: voiceCount,
    locations: {
      exact: approved.filter((candidate) => candidate.privacyLevel === "exact").length,
      approximate: approved.filter(
        (candidate) => candidate.privacyLevel === "approximate",
      ).length,
      private: approved.filter((candidate) => candidate.privacyLevel === "private")
        .length,
    },
    blockedAttachmentsIncluded: 0,
    readyToPublish: approved.length > 0,
  };
}
