import type { MediaType } from "@/lib/database.types";

export const MEDIA_LIMITS: Record<MediaType, number> = {
  image: 20 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
};

const MIME_TYPES: Record<string, MediaType> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
};

export function mediaTypeForMime(mime: string): MediaType | null {
  return MIME_TYPES[mime] ?? null;
}

export function validateMediaUpload(mime: string, size: number) {
  const type = mediaTypeForMime(mime);
  if (!type) throw new Error("不支持这个媒体格式。");
  if (!Number.isFinite(size) || size <= 0 || size > MEDIA_LIMITS[type]) {
    throw new Error(
      `${type === "image" ? "图片" : type === "video" ? "视频" : "音频"}文件大小超出限制。`,
    );
  }
  return type;
}

export function extensionForMime(mime: string) {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  }[mime];
}
