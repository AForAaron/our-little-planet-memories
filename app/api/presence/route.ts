import { NextResponse } from "next/server";
import { getPresenceSummary, updatePresence } from "@/lib/data/footprints";
import { rejectCrossOriginRequest } from "@/lib/security/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "操作失败。";
  const status = message.includes("登录") ? 401 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    return NextResponse.json(await getPresenceSummary());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      currentPath?: unknown;
      pageTitle?: unknown;
    };
    return NextResponse.json(
      await updatePresence({
        currentPath: body.currentPath,
        pageTitle: body.pageTitle,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
