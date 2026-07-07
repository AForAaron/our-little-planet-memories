import { NextResponse } from "next/server";
import { canUseReview, getOverview } from "@/features/import-review/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!canUseReview(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    return NextResponse.json(await getOverview());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "无法读取清洗结果，请先运行 data:prepare。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
