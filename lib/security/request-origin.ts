import "server-only";

import { NextResponse } from "next/server";
import { isLiveMode } from "@/lib/config/backend";

/**
 * Cookie authentication already uses SameSite=Strict. This check is a second
 * boundary for write endpoints, including requests from same-site Vercel apps.
 */
export function rejectCrossOriginRequest(request: Request) {
  if (!isLiveMode()) return null;

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || fetchSite === "cross-site") return forbidden();

  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      return forbidden();
    }
  } catch {
    return forbidden();
  }

  return null;
}

function forbidden() {
  return NextResponse.json(
    { error: "请求必须从本站页面发起。" },
    { status: 403 },
  );
}
