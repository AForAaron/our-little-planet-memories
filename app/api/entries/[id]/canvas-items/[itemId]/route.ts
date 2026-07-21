import { NextResponse } from "next/server";
import {
  deleteEntryCanvasItem,
  updateEntryCanvasItem,
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
  if (status === 500) console.error("Entry canvas item request failed", error);
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

type ItemRouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function PATCH(request: Request, { params }: ItemRouteContext) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;

  try {
    const { id, itemId } = await params;
    const item = await updateEntryCanvasItem(
      id,
      itemId,
      await readJson(request),
    );
    return NextResponse.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: ItemRouteContext) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) return originRejection;

  try {
    const { id, itemId } = await params;
    return NextResponse.json(
      await deleteEntryCanvasItem(id, itemId, await readJson(request)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
