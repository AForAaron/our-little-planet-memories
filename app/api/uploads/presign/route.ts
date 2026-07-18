import { inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode, isR2Configured } from "@/lib/config/backend";
import { getDatabase } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import {
  extensionForMime,
  validateMediaUpload,
} from "@/lib/media/policy";
import {
  createPrivateUploadUrl,
  deletePrivateObject,
} from "@/lib/r2/client";
import { rejectCrossOriginRequest } from "@/lib/security/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;

  if (!isLiveMode() || !isR2Configured()) {
    return NextResponse.json({ error: "媒体后端尚未启用。" }, { status: 503 });
  }
  const user = await getCoupleUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或不在白名单中。" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      fileName?: string;
      mime?: string;
      size?: number;
      variant?: string;
    };
    const mime = String(body.mime ?? "");
    const size = Number(body.size);
    const variant = body.variant === "thumbnail" ? "thumbnail" : "original";
    const type = validateMediaUpload(mime, size);
    if (variant === "thumbnail" && (type !== "image" || mime !== "image/webp" || size > 2 * 1024 * 1024)) {
      throw new Error("缩略图必须是 2MB 以内的 WebP 图片。");
    }
    const extension = extensionForMime(mime);
    if (!extension) throw new Error("无法识别文件扩展名。");
    const r2Key = variant === "thumbnail"
      ? `uploads/${user.id}/thumbnails/${crypto.randomUUID()}.${extension}`
      : `uploads/${user.id}/${crypto.randomUUID()}.${extension}`;
    const uploadUrl = await createPrivateUploadUrl(r2Key, mime, size, 600);
    return NextResponse.json({
      r2Key,
      uploadUrl,
      expiresIn: 600,
      mime,
      type,
      originalName: String(body.fileName ?? "media").slice(0, 200),
      variant,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法创建上传地址。" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;

  const user = await getCoupleUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { keys?: unknown };
  const requestedKeys = Array.isArray(body.keys) ? body.keys : [];
  const keys = Array.from(
    new Set(
      requestedKeys.filter(
        (key): key is string =>
          typeof key === "string" &&
          key.length <= 1_024 &&
          key.startsWith(`uploads/${user.id}/`),
      ),
    ),
  ).slice(0, 40);
  const references = keys.length
    ? await getDatabase()
        .select({ r2Key: media.r2Key, thumbnailR2Key: media.thumbnailR2Key })
        .from(media)
        .where(
          or(
            inArray(media.r2Key, keys),
            inArray(media.thumbnailR2Key, keys),
          ),
        )
    : [];
  const referencedKeys = new Set(
    references
      .flatMap((item) => [item.r2Key, item.thumbnailR2Key])
      .filter(Boolean),
  );
  const temporaryKeys = keys.filter((key) => !referencedKeys.has(key));
  const results = await Promise.allSettled(
    temporaryKeys.map((key) => deletePrivateObject(key)),
  );
  return NextResponse.json({
    deleted: results.filter((result) => result.status === "fulfilled").length,
    skippedReferenced: keys.length - temporaryKeys.length,
    failed: results.filter((result) => result.status === "rejected").length,
  });
}
