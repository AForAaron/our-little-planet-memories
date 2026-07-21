import { NextResponse } from "next/server";
import {
  createEntryCanvasItem,
  getEntryCanvasItems,
} from "@/lib/data/entry-canvas";
import { CanvasValidationError } from "@/lib/canvas/validation";
import {
  getEntryCanvasConflictItem,
  getEntryCanvasErrorMessage,
  getEntryCanvasErrorStatus,
} from "@/lib/canvas/errors";
import { rejectCrossOriginRequest } from "@/lib/security/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const status = getEntryCanvasErrorStatus(error);
  if (status === 500) console.error("Entry canvas request failed", error);
  const message = getEntryCanvasErrorMessage(error);
  const latestItem = getEntryCanvasConflictItem(error);
  return NextResponse.json(
    latestItem ? { error: message, item: latestItem } : { error: message },
    { status },
  );
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new CanvasValidationError("请求内容必须是有效的 JSON。");
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(
      { items: await getEntryCanvasItems(id) },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;

  try {
    const { id } = await params;
    const item = await createEntryCanvasItem(id, await readJson(request));
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
