import { NextResponse } from "next/server";
import { createFootprint, getFootprints } from "@/lib/data/footprints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "操作失败。";
  const status = message.includes("登录") ? 401 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pagePath = url.searchParams.get("pagePath") ?? undefined;
    const includeInstant = url.searchParams.get("includeInstant") === "1";
    const limit = Number(url.searchParams.get("limit") ?? 40);
    return NextResponse.json({
      events: await getFootprints({ pagePath, includeInstant, limit }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
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
