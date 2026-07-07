import { NextResponse } from "next/server";
import {
  canUseReview,
  getReviewActor,
  mergeCandidates,
} from "@/features/import-review/server/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = (await request.json()) as { ids?: string[] };
    const candidate = await mergeCandidates(body.ids ?? [], getReviewActor(request));
    return NextResponse.json({ candidate });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "合并失败。" },
      { status: 400 },
    );
  }
}
