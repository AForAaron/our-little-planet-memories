import "server-only";

import { NextResponse } from "next/server";
import { isLiveMode } from "@/lib/config/backend";
import { isTrustedSameOriginRequest } from "@/lib/security/request-origin-policy";

/**
 * Cookie authentication already uses SameSite=Strict. This check is a second
 * boundary for write endpoints, including requests from same-site Vercel apps.
 */
export function rejectCrossOriginRequest(request: Request) {
  if (!isLiveMode()) return null;

  if (!isTrustedSameOriginRequest({
    requestUrl: request.url,
    origin: request.headers.get("origin"),
    fetchSite: request.headers.get("sec-fetch-site"),
  })) return forbidden();

  return null;
}

function forbidden() {
  return NextResponse.json(
    { error: "请求必须从本站页面发起。" },
    { status: 403 },
  );
}
