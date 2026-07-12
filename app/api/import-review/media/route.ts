import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { canUseReview } from "@/features/import-review/server/store";
import { getImportRoots } from "@/features/import-review/server/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".silk": "application/octet-stream",
};

async function safePath(relative: string) {
  const { dataRoot } = getImportRoots();
  const resolved = path.resolve(dataRoot, relative);
  if (resolved !== dataRoot && !resolved.startsWith(`${dataRoot}${path.sep}`)) {
    throw new Error("非法媒体路径。");
  }
  const [realRoot, realFile] = await Promise.all([
    realpath(dataRoot),
    realpath(resolved),
  ]);
  if (realFile !== realRoot && !realFile.startsWith(`${realRoot}${path.sep}`)) {
    throw new Error("非法媒体路径。");
  }
  return realFile;
}

function streamFile(file: string, options?: { start: number; end: number }) {
  return Readable.toWeb(createReadStream(file, options)) as ReadableStream;
}

export async function GET(request: Request) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const url = new URL(request.url);
    const relative = url.searchParams.get("path");
    if (!relative) throw new Error("缺少媒体路径。");
    const file = await safePath(relative);
    const info = await stat(file);
    const contentType =
      CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    const range = request.headers.get("range");
    if (range && /^(?:video|audio)\//.test(contentType)) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      const start = match?.[1] ? Number(match[1]) : 0;
      const end = match?.[2] ? Number(match[2]) : info.size - 1;
      if (start < 0 || end < start || start >= info.size) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${info.size}` },
        });
      }
      const boundedEnd = Math.min(end, info.size - 1);
      return new Response(streamFile(file, { start, end: boundedEnd }), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(boundedEnd - start + 1),
          "Content-Range": `bytes ${start}-${boundedEnd}/${info.size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
    return new Response(streamFile(file), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法读取媒体。" },
      { status: 404 },
    );
  }
}
