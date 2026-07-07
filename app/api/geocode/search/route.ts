import { NextResponse } from "next/server";
import { getCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NominatimResult = {
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  class?: string;
  type?: string;
};

type GeocodeResult = {
  name: string;
  displayName: string;
  latitude: string;
  longitude: string;
  category?: string;
};

const cache = new Map<string, { expiresAt: number; results: GeocodeResult[] }>();
let lastUncachedRequestAt = 0;

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 160);
}

const REGION_TOKENS = [
  "新疆",
  "伊宁",
  "伊宁市",
  "伊犁",
  "乌鲁木齐",
  "北京",
  "上海",
  "广州",
  "深圳",
  "杭州",
  "成都",
  "重庆",
  "西安",
  "南京",
  "苏州",
  "合肥",
  "青海",
  "甘肃",
  "西藏",
  "云南",
  "四川",
  "浙江",
  "江苏",
  "安徽",
];

function requestedRegionTokens(query: string) {
  return REGION_TOKENS.filter((token) => query.includes(token));
}

function matchesRequestedRegion(result: GeocodeResult, tokens: string[]) {
  if (!tokens.length) return true;
  const haystack = `${result.name} ${result.displayName}`;
  return tokens.some((token) => haystack.includes(token));
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  if (isLiveMode()) {
    const user = await getCoupleUser();
    if (!user) return jsonError("请先登录后再搜索地点。", 401);
  }

  const requestUrl = new URL(request.url);
  const query = normalizeQuery(requestUrl.searchParams.get("q") ?? "");
  if (!query) return jsonError("请输入地点名称。");

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ results: cached.results, cached: true });
  }

  const now = Date.now();
  if (now - lastUncachedRequestAt < 1100) {
    return jsonError("地点搜索太频繁，请稍等 1 秒再试。", 429);
  }
  lastUncachedRequestAt = now;

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.searchParams.set("format", "jsonv2");
  nominatimUrl.searchParams.set("q", query);
  nominatimUrl.searchParams.set("limit", "5");
  nominatimUrl.searchParams.set("addressdetails", "1");
  nominatimUrl.searchParams.set("namedetails", "1");
  nominatimUrl.searchParams.set("accept-language", "zh-CN,zh,en");

  const response = await fetch(nominatimUrl, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "User-Agent":
        process.env.GEOCODING_USER_AGENT ??
        "OurLittlePlanetMemories/1.0 (private couple memories site)",
    },
  });

  if (!response.ok) {
    return jsonError(`地点服务暂时不可用（${response.status}），请稍后重试或手动选择地图位置。`, 502);
  }

  const rawResults = (await response.json()) as NominatimResult[];
  const tokens = requestedRegionTokens(query);
  const results = rawResults
    .map((item): GeocodeResult | null => {
      const latitude = item.lat ? Number(item.lat) : NaN;
      const longitude = item.lon ? Number(item.lon) : NaN;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const category = [item.class, item.type].filter(Boolean).join(" · ");
      return {
        name: item.name || query,
        displayName: item.display_name || item.name || query,
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
        ...(category ? { category } : {}),
      };
    })
    .filter((item): item is GeocodeResult => Boolean(item))
    .filter((item) => matchesRequestedRegion(item, tokens));

  cache.set(cacheKey, {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    results,
  });

  return NextResponse.json({ results });
}
