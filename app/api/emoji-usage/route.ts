import { NextResponse } from "next/server";
import { isSupportedEmoji } from "@/lib/emoji/catalog";
import { getEmojiUsage, recordEmojiUsage } from "@/lib/data/emoji-usage";
import { rejectCrossOriginRequest } from "@/lib/security/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "常用 Emoji 操作失败。";
  return NextResponse.json(
    { error: message },
    { status: message.includes("登录") ? 401 : 400 },
  );
}

export async function GET() {
  try {
    return NextResponse.json({ items: await getEmojiUsage() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;

  try {
    const body = (await request.json().catch(() => ({}))) as { emoji?: unknown };
    if (!isSupportedEmoji(body.emoji)) {
      return NextResponse.json({ error: "不支持的 Emoji。" }, { status: 400 });
    }
    return NextResponse.json({ item: await recordEmojiUsage(body.emoji) });
  } catch (error) {
    return errorResponse(error);
  }
}
