import { NextResponse } from "next/server";
import {
  createEntryFollowUp,
  getEntryFollowUps,
} from "@/lib/data/entry-follow-ups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "追评操作失败。";
  return NextResponse.json(
    { error: message },
    { status: message.includes("登录") ? 401 : 400 },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ items: await getEntryFollowUps(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      body?: unknown;
      parentId?: unknown;
    };
    return NextResponse.json({
      item: await createEntryFollowUp({
        entryId: id,
        body: body.body,
        parentId: body.parentId,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
