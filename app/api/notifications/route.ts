import { NextResponse } from "next/server";
import {
  getNotifications,
  markNotificationsRead,
} from "@/lib/data/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "通知操作失败。";
  return NextResponse.json(
    { error: message },
    { status: message.includes("登录") ? 401 : 400 },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 30);
    return NextResponse.json(await getNotifications(limit));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      all?: unknown;
    };
    return NextResponse.json(await markNotificationsRead(body));
  } catch (error) {
    return errorResponse(error);
  }
}
