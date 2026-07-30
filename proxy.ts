import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  CLOUDBASE_SESSION_COOKIE,
  getAuthProvider,
  isCloudBaseAuthConfigured,
} from "@/lib/auth/cloudbase-shared";
import { getAuth } from "@/lib/auth/server";
import { isLiveMode, isNeonConfigured } from "@/lib/config/backend";

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLocalReviewRoute =
    pathname === "/review" ||
    pathname === "/import-review" ||
    pathname.startsWith("/api/import-review/");

  if (
    isLocalReviewRoute &&
    process.env.NODE_ENV !== "production" &&
    process.env.IMPORT_REVIEW_MODE === "1"
  ) {
    return NextResponse.next();
  }

  if (!isLiveMode()) {
    return NextResponse.next();
  }

  const usingCloudBase =
    getAuthProvider() === "cloudbase" && isCloudBaseAuthConfigured();
  const usingNeon = getAuthProvider() !== "cloudbase" && isNeonConfigured();
  if (!usingCloudBase && !usingNeon) {
    return NextResponse.next();
  }

  const apiHandlesOwnAuth =
    pathname === "/api/companion/messages" ||
    pathname === "/api/emoji-usage" ||
    pathname === "/api/entries" ||
    pathname.startsWith("/api/entries/") ||
    pathname === "/api/footprints" ||
    pathname.startsWith("/api/footprints/") ||
    pathname.startsWith("/api/geocode/") ||
    pathname === "/api/map-points" ||
    pathname === "/api/notifications" ||
    pathname === "/api/presence" ||
    pathname === "/api/settings" ||
    pathname === "/api/wishlist" ||
    pathname.startsWith("/api/uploads/");
  if (apiHandlesOwnAuth) return NextResponse.next();

  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/auth/");
  if (isPublicRoute) return NextResponse.next();

  if (usingCloudBase) {
    const session = request.cookies.get(CLOUDBASE_SESSION_COOKIE)?.value;
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return getAuth().middleware({ loginUrl: "/login" })(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
