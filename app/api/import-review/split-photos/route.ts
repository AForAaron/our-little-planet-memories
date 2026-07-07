import { NextResponse } from "next/server";
import {
  canUseReview,
  getReviewActor,
  splitPhotoCandidate,
} from "@/features/import-review/server/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = (await request.json()) as {
      candidateId?: string;
      splitPhotoPath?: string;
    };
    if (!body.candidateId || !body.splitPhotoPath) {
      throw new Error("缺少照片候选或拆分点。");
    }
    return NextResponse.json({
      candidates: await splitPhotoCandidate(
        body.candidateId,
        body.splitPhotoPath,
        getReviewActor(request),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "拆分照片失败。" },
      { status: 400 },
    );
  }
}
