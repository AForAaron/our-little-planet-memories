import { NextResponse } from "next/server";
import {
  REVIEW_ACCESS_COOKIE,
  reviewAccessCookieValue,
  reviewModeEnabled,
  validateReviewAccessToken,
} from "@/features/import-review/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!reviewModeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body.token ?? "";
  if (!validateReviewAccessToken(token)) {
    return NextResponse.json(
      { error: "访问码不正确，或 REVIEW_ACCESS_TOKEN 尚未配置。" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(REVIEW_ACCESS_COOKIE, reviewAccessCookieValue(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: request.url.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
