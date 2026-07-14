import { NextResponse } from "next/server";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import {
  getMapPoints,
  MAP_VIEWPORT_POINT_LIMIT,
  type MapPointBounds,
} from "@/lib/data/memories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readBounds(value: string | null): MapPointBounds {
  if (!value) throw new Error("缺少地图视野参数。");
  const parts = value.split(",").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error("地图视野参数无效。");
  }
  const [south, west, north, east] = parts;
  if (
    south < -90 ||
    south > 90 ||
    north < -90 ||
    north > 90 ||
    south > north ||
    west < -180 ||
    west > 180 ||
    east < -180 ||
    east > 180
  ) {
    throw new Error("地图视野超出有效范围。");
  }
  return { south, west, north, east };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "地点加载失败。";
  const status = message.includes("登录") ? 401 : 400;
  return NextResponse.json({ error: message }, { status });
}

/**
 * Private, authenticated map reads. The client sends only its current Leaflet
 * bbox, so a growing archive never requires an all-history R2 signing pass.
 */
export async function GET(request: Request) {
  try {
    if (isLiveMode()) {
      const user = await getCoupleUser();
      if (!user) throw new Error("登录已失效，请重新登录。");
    }
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    if (scope && scope !== "food") {
      throw new Error("不支持的地图范围。");
    }
    const page = await getMapPoints(scope === "food", {
      bbox: readBounds(url.searchParams.get("bbox")),
      limit: MAP_VIEWPORT_POINT_LIMIT,
    });
    return NextResponse.json(page, {
      headers: {
        // Signed R2 URLs belong to the couple only; do not place them in a
        // shared cache even though this endpoint is GET.
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
