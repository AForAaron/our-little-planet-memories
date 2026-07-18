import { NextResponse } from "next/server";
import {
  createCompanionMessage,
  getCompanionMessages,
} from "@/lib/data/companion-messages";
import { rejectCrossOriginRequest } from "@/lib/security/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "悄悄话操作失败。";
  return NextResponse.json(
    { error: message },
    {
      status: message.includes("登录") ? 401 : 400,
      headers: NO_STORE_HEADERS,
    },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 30);
    return NextResponse.json(
      { messages: await getCompanionMessages(limit) },
      { headers: NO_STORE_HEADERS },
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
      body?: unknown;
      pagePath?: unknown;
      pageTitle?: unknown;
    };
    return NextResponse.json({
      message: await createCompanionMessage(body),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
