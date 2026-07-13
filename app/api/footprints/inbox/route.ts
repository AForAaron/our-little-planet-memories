import { NextResponse } from "next/server";
import {
  completeEntryAttention,
  getPendingEntryAttention,
} from "@/lib/data/activity-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "待办操作失败。";
  return NextResponse.json(
    { error: message },
    { status: message.includes("登录") ? 401 : 400 },
  );
}

export async function GET() {
  try {
    return NextResponse.json(await getPendingEntryAttention());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      entryId?: unknown;
    };
    return NextResponse.json(await completeEntryAttention(body.entryId));
  } catch (error) {
    return errorResponse(error);
  }
}
