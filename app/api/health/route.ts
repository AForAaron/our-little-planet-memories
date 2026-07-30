import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight liveness probe for CloudBase Run / Docker.
 * Never touches Auth, database, object storage, or secrets.
 */
export async function GET(request: NextRequest) {
  const wantSharp = request.nextUrl.searchParams.get("sharp") === "1";
  const body: {
    ok: true;
    service: string;
    mode: string;
    timestamp: string;
    sharp?: { ok: boolean; version?: string; error?: string };
  } = {
    ok: true,
    service: "our-little-planet",
    mode: process.env.APP_DATA_MODE === "live" ? "live" : "demo",
    timestamp: new Date().toISOString(),
  };

  if (wantSharp) {
    try {
      const sharp = (await import("sharp")).default;
      const version = sharp.versions?.sharp ?? "unknown";
      // Tiny 1x1 PNG encode proves native libs load.
      await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();
      body.sharp = { ok: true, version };
    } catch (error) {
      body.sharp = {
        ok: false,
        error: error instanceof Error ? error.message : "sharp probe failed",
      };
      return NextResponse.json(body, { status: 503 });
    }
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
