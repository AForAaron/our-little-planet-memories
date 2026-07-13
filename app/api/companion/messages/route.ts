import { NextResponse } from "next/server";
import {
  createCompanionMessage,
  getCompanionMessages,
} from "@/lib/data/companion-messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "悄悄话操作失败。";
  return NextResponse.json(
    { error: message },
    { status: message.includes("登录") ? 401 : 400 },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 30);
    return NextResponse.json({ messages: await getCompanionMessages(limit) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
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
