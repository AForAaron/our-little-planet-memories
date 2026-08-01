/**
 * Shared Gaode (Amap) raster tiles for Leaflet.
 * Official pages must not auto-request OSM/CARTO.
 */
export const AMAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://lbs.amap.com/">高德地图</a>';

/** Standard road style tiles (subdomains 1-4). */
export const AMAP_ROAD_TILE_URL =
  "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";

/** Satellite + road overlay alternative if road tiles fail. */
export const AMAP_SAT_TILE_URL =
  "https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}";

export const AMAP_TILE_SUBDOMAINS = ["1", "2", "3", "4"];

export const amapTileSources = [
  {
    id: "amap-road",
    url: AMAP_ROAD_TILE_URL,
    attribution: AMAP_TILE_ATTRIBUTION,
    subdomains: AMAP_TILE_SUBDOMAINS,
  },
  {
    id: "amap-sat",
    url: AMAP_SAT_TILE_URL,
    attribution: AMAP_TILE_ATTRIBUTION,
    subdomains: AMAP_TILE_SUBDOMAINS,
  },
] as const;
