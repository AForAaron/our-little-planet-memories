import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthBody = {
  ok: boolean;
  service: string;
  mode: string;
  timestamp: string;
  sharp?: { ok: boolean; version?: string; error?: string };
  db?: {
    ok: boolean;
    driver?: string;
    profilesCount?: number;
    error?: string;
  };
};

/**
 * Liveness / readiness probe for CloudBase Run.
 * - default: no secrets, no DB
 * - ?sharp=1: native sharp encode
 * - ?db=1: optional Postgres probe when DATABASE_URL is configured (no secret echo)
 */
export async function GET(request: NextRequest) {
  const wantSharp = request.nextUrl.searchParams.get("sharp") === "1";
  const wantDb = request.nextUrl.searchParams.get("db") === "1";
  const body: HealthBody = {
    ok: true,
    service: "our-little-planet",
    mode: process.env.APP_DATA_MODE === "live" ? "live" : "demo",
    timestamp: new Date().toISOString(),
  };

  if (wantSharp) {
    try {
      const sharp = (await import("sharp")).default;
      const version = sharp.versions?.sharp ?? "unknown";
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
      body.ok = false;
      body.sharp = {
        ok: false,
        error: error instanceof Error ? error.message : "sharp probe failed",
      };
    }
  }

  if (wantDb) {
    if (!process.env.DATABASE_URL) {
      body.ok = false;
      body.db = { ok: false, error: "DATABASE_URL not set" };
    } else {
      try {
        const { getDatabase, getDatabaseDriver } = await import("@/lib/db/client");
        const { profiles } = await import("@/lib/db/schema");
        const rows = await getDatabase().select({ id: profiles.id }).from(profiles).limit(5);
        body.db = {
          ok: true,
          driver: getDatabaseDriver(),
          profilesCount: rows.length,
        };
      } catch (error) {
        body.ok = false;
        body.db = {
          ok: false,
          error: error instanceof Error ? error.message : "db probe failed",
        };
      }
    }
  }

  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
