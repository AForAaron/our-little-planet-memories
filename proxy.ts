import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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

  if (!isLiveMode() || !isNeonConfigured()) {
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
    pathname.startsWith("/api/auth/");
  if (isPublicRoute) return NextResponse.next();

  return getAuth().middleware({ loginUrl: "/login" })(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
