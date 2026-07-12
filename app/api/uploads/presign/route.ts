import { NextResponse } from "next/server";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode, isR2Configured } from "@/lib/config/backend";
import {
  extensionForMime,
  validateMediaUpload,
} from "@/lib/media/policy";
import {
  createPrivateUploadUrl,
  deletePrivateObject,
} from "@/lib/r2/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    };
    const mime = String(body.mime ?? "");
    const size = Number(body.size);
    const type = validateMediaUpload(mime, size);
    const extension = extensionForMime(mime);
    if (!extension) throw new Error("无法识别文件扩展名。");
    const r2Key = `uploads/${user.id}/${crypto.randomUUID()}.${extension}`;
    const uploadUrl = await createPrivateUploadUrl(r2Key, mime, size, 600);
    return NextResponse.json({
      r2Key,
      uploadUrl,
      expiresIn: 600,
      mime,
      type,
      originalName: String(body.fileName ?? "media").slice(0, 200),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法创建上传地址。" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getCoupleUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }
  const body = (await request.json()) as { keys?: string[] };
  const keys = (body.keys ?? []).filter((key) =>
    key.startsWith(`uploads/${user.id}/`),
  );
  await Promise.allSettled(keys.map((key) => deletePrivateObject(key)));
  return NextResponse.json({ deleted: keys.length });
}
