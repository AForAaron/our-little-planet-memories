import { NextResponse } from "next/server";
import {
  canUseReview,
  getReviewActor,
  splitCandidate,
} from "@/features/import-review/server/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = (await request.json()) as {
      candidateId?: string;
      splitMessageId?: string;
    };
    if (!body.candidateId || !body.splitMessageId) {
      throw new Error("缺少候选事件或拆分点。");
    }
    const candidates = await splitCandidate(
      body.candidateId,
      body.splitMessageId,
      getReviewActor(request),
    );
    return NextResponse.json({ candidates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "拆分失败。" },
      { status: 400 },
    );
  }
}
