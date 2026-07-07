import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/server";
import { isNeonConfigured } from "@/lib/config/backend";

type AuthContext = { params: Promise<{ path: string[] }> };

function unavailable() {
  return NextResponse.json(
    { error: "Neon Auth 尚未配置。" },
    { status: 503 },
  );
}

export function GET(request: Request, context: AuthContext) {
  if (!isNeonConfigured()) return unavailable();
  return getAuth().handler().GET(request, context);
}

export function POST(request: Request, context: AuthContext) {
  if (!isNeonConfigured()) return unavailable();
  return getAuth().handler().POST(request, context);
}
