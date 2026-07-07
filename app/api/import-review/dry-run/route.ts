import { NextResponse } from "next/server";
import { canUseReview, dryRunSummary } from "@/features/import-review/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(await dryRunSummary());
}
