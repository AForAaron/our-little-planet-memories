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

type AmapPoi = {
  id?: string;
  name?: string;
  type?: string;
  address?: string | unknown[];
  pname?: string;
  cityname?: string;
  adname?: string;
  location?: string;
};

type AmapSearchResponse = {
  status?: string;
  info?: string;
  infocode?: string;
  pois?: AmapPoi[];
};

type GeocodeResult = {
  name: string;
  displayName: string;
  latitude: string;
  longitude: string;
  category?: string;
  provider?: "amap" | "osm";
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

const AMAP_CITY_TOKENS = [
  "伊宁市",
  "伊宁",
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
];

function requestedRegionTokens(query: string) {
  return REGION_TOKENS.filter((token) => query.includes(token));
}

function matchesRequestedRegion(result: GeocodeResult, tokens: string[]) {
  if (!tokens.length) return true;
  const haystack = `${result.name} ${result.displayName}`;
  return tokens.some((token) => haystack.includes(token));
}

function inferAmapCity(query: string) {
  const match = AMAP_CITY_TOKENS.find((token) => query.includes(token));
  return match ?? "";
}

function isInChina(latitude: number, longitude: number) {
  return longitude >= 72.004 && longitude <= 137.8347 && latitude >= 0.8293 && latitude <= 55.8271;
}

function transformLatitude(x: number, y: number) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLongitude(x: number, y: number) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

function gcj02ToWgs84(latitude: number, longitude: number) {
  if (!isInChina(latitude, longitude)) return { latitude, longitude };
  const earthRadius = 6378245.0;
  const eccentricity = 0.00669342162296594323;
  let dLat = transformLatitude(longitude - 105.0, latitude - 35.0);
  let dLon = transformLongitude(longitude - 105.0, latitude - 35.0);
  const radLat = (latitude / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - eccentricity * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((earthRadius * (1 - eccentricity)) / (magic * sqrtMagic)) * Math.PI);
  dLon = (dLon * 180.0) / ((earthRadius / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return {
    latitude: latitude * 2 - (latitude + dLat),
    longitude: longitude * 2 - (longitude + dLon),
  };
}

function parseAmapLocation(location: string | undefined) {
  if (!location) return null;
  const [longitudeText, latitudeText] = location.split(",");
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return gcj02ToWgs84(latitude, longitude);
}

function stringifyAddress(address: AmapPoi["address"]) {
  return Array.isArray(address) ? address.join("") : address || "";
}

function amapConfigured() {
  return Boolean(process.env.AMAP_WEB_SERVICE_KEY?.trim());
}

async function searchAmap(query: string): Promise<GeocodeResult[]> {
  const key = process.env.AMAP_WEB_SERVICE_KEY?.trim();
  if (!key) return [];

  const city = inferAmapCity(query);
  const amapUrl = new URL("https://restapi.amap.com/v3/place/text");
  amapUrl.searchParams.set("key", key);
  amapUrl.searchParams.set("keywords", query);
  amapUrl.searchParams.set("offset", "8");
  amapUrl.searchParams.set("page", "1");
  amapUrl.searchParams.set("extensions", "base");
  amapUrl.searchParams.set("output", "JSON");
  if (city) {
    amapUrl.searchParams.set("city", city);
    amapUrl.searchParams.set("citylimit", "true");
  }

  const response = await fetch(amapUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        process.env.GEOCODING_USER_AGENT ??
        "OurLittlePlanetMemories/1.0 (private couple memories site)",
    },
  });

  if (!response.ok) {
    throw new Error(`高德地点服务暂时不可用（${response.status}）。`);
  }

  const payload = (await response.json()) as AmapSearchResponse;
  if (payload.status !== "1") {
    throw new Error(`高德地点搜索失败：${payload.info || payload.infocode || "未知错误"}`);
  }

  const tokens = requestedRegionTokens(query);
  return (payload.pois ?? [])
    .map((poi): GeocodeResult | null => {
      const converted = parseAmapLocation(poi.location);
      if (!converted) return null;
      const address = stringifyAddress(poi.address);
      const region = [poi.pname, poi.cityname, poi.adname].filter(Boolean).join(" ");
      const displayName = [poi.name, address, region].filter(Boolean).join("，");
      return {
        name: poi.name || query,
        displayName: displayName || poi.name || query,
        latitude: converted.latitude.toFixed(6),
        longitude: converted.longitude.toFixed(6),
        category: poi.type ? `高德 · ${poi.type}` : "高德",
        provider: "amap",
      };
    })
    .filter((item): item is GeocodeResult => Boolean(item))
    .filter((item) => matchesRequestedRegion(item, tokens));
}

async function searchNominatim(query: string): Promise<GeocodeResult[]> {
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
    throw new Error(`OpenStreetMap 地点服务暂时不可用（${response.status}）。`);
  }

  const rawResults = (await response.json()) as NominatimResult[];
  const tokens = requestedRegionTokens(query);
  return rawResults
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
        ...(category ? { category: `OSM · ${category}` } : { category: "OSM" }),
        provider: "osm",
      };
    })
    .filter((item): item is GeocodeResult => Boolean(item))
    .filter((item) => matchesRequestedRegion(item, tokens));
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

  const preferredProvider = process.env.GEOCODING_PROVIDER?.trim().toLowerCase();
  const shouldPreferAmap = preferredProvider === "amap" || (!preferredProvider && amapConfigured());
  const cacheKey = `${shouldPreferAmap ? "amap" : "osm"}:${query.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ results: cached.results, cached: true });
  }

  const now = Date.now();
  if (now - lastUncachedRequestAt < 1100) {
    return jsonError("地点搜索太频繁，请稍等 1 秒再试。", 429);
  }
  lastUncachedRequestAt = now;

  let results: GeocodeResult[] = [];
  let provider = "osm";
  let providerError = "";
  try {
    if (shouldPreferAmap) {
      provider = "amap";
      results = await searchAmap(query);
    }
    if (!results.length && preferredProvider !== "amap") {
      provider = "osm";
      results = await searchNominatim(query);
    }
  } catch (error) {
    providerError = error instanceof Error ? error.message : "地点搜索失败。";
    if (provider !== "osm" && preferredProvider !== "amap") {
      try {
        provider = "osm";
        results = await searchNominatim(query);
      } catch (fallbackError) {
        providerError =
          fallbackError instanceof Error ? fallbackError.message : providerError;
      }
    }
  }

  if (!results.length && providerError) {
    return jsonError(`${providerError} 请稍后重试，或手动在地图上点选位置。`, 502);
  }

  cache.set(cacheKey, {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    results,
  });

  return NextResponse.json({ results, provider });
}
