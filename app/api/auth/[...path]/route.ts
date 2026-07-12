import { NextResponse } from "next/server";
import { emailIsAllowlisted, getAuth } from "@/lib/auth/server";
import { isLiveMode, isNeonConfigured } from "@/lib/config/backend";

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

async function guardRegistration(request: Request, context: AuthContext) {
  const { path } = await context.params;
  if (path.join("/").toLowerCase() !== "sign-up/email") return null;
  if (!isLiveMode()) {
    return NextResponse.json(
      { error: "演示模式不允许创建账号。" },
      { status: 403 },
    );
  }
  const payload = (await request.clone().json().catch(() => null)) as
    | { email?: unknown }
    | null;
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  if (!emailIsAllowlisted(email)) {
    return NextResponse.json(
      { error: "这个邮箱不在小星球的双人白名单里。" },
      { status: 403 },
    );
  }
  return null;
}

export async function POST(request: Request, context: AuthContext) {
  if (!isNeonConfigured()) return unavailable();
  const rejection = await guardRegistration(request, context);
  if (rejection) return rejection;
  return getAuth().handler().POST(request, context);
}
