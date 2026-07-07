import { NextResponse } from "next/server";
import {
  canUseReview,
  getCandidate,
  getReviewActor,
  ReviewConflictError,
  updateCandidate,
} from "@/features/import-review/server/store";
import type { CandidatePatch } from "@/features/import-review/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { id } = await params;
  const detail = await getCandidate(id);
  if (!detail) {
    return NextResponse.json({ error: "没有找到这个候选事件。" }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const { id } = await params;
    const patch = (await request.json()) as CandidatePatch;
    const candidate = await updateCandidate(id, patch, getReviewActor(request));
    if (!candidate) {
      return NextResponse.json({ error: "没有找到这个候选事件。" }, { status: 404 });
    }
    return NextResponse.json({ candidate });
  } catch (error) {
    if (error instanceof ReviewConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败。" },
      { status: 400 },
    );
  }
}
