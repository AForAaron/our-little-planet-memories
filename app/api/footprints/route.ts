import { NextResponse } from "next/server";
import { getActivityStream } from "@/lib/data/activity-stream";
import { createFootprint } from "@/lib/data/footprints";
import { rejectCrossOriginRequest } from "@/lib/security/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "操作失败。";
  const message = rawMessage.includes("footprint_events")
    ? "足迹/追评数据表还没有创建，请先在生产数据库执行 drizzle migration。"
    : rawMessage;
  const status = message.includes("登录") ? 401 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? 40);
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 40;
    return NextResponse.json(
      await getActivityStream({
        filter: url.searchParams.get("filter") ?? undefined,
        before: url.searchParams.get("before") ?? undefined,
        limit,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      eventType?: unknown;
      scope?: unknown;
      pagePath?: unknown;
      pageTitle?: unknown;
      targetType?: unknown;
      targetId?: unknown;
      body?: unknown;
      reaction?: unknown;
    };
    return NextResponse.json({
      event: await createFootprint(body),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
