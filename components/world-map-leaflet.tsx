"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { readApiJson } from "@/lib/http/read-api-json";
import { formatDate } from "@/lib/utils";
import type { WorldMapPoint } from "./world-map";

type LeafletWorldMapProps = {
  points: WorldMapPoint[];
  height?: string;
  routeLabel?: string;
  enableViewportLoading?: boolean;
  category?: "food";
};

const MAP_REQUEST_DEBOUNCE_MS = 140;
const MAP_INITIALIZATION_DELAY_MS = 350;

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markerIcon(category: string) {
  const categoryClass = category === "food" ? "is-food" : category === "trip" ? "is-trip" : "is-memory";
  return L.divIcon({
    className: "",
    html: `<span class="planet-marker ${categoryClass}" aria-hidden="true"></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

function isValidPoint(point: WorldMapPoint) {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}

function readPoints(value: unknown): WorldMapPoint[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (point): point is WorldMapPoint =>
      typeof point === "object" &&
      point !== null &&
      typeof point.id === "string" &&
      typeof point.title === "string" &&
      typeof point.happenedAt === "string" &&
      typeof point.latitude === "number" &&
      typeof point.longitude === "number" &&
      typeof point.category === "string" &&
      isValidPoint(point as WorldMapPoint),
  );
}

function wrapLongitude(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function viewportBbox(map: L.Map) {
  const bounds = map.getBounds();
  const south = Math.max(-90, Math.min(90, bounds.getSouth()));
  const north = Math.max(-90, Math.min(90, bounds.getNorth()));
  const rawWest = bounds.getWest();
  const rawEast = bounds.getEast();
  const [west, east] =
    Math.abs(rawEast - rawWest) >= 359.999
      ? [-180, 180]
      : [wrapLongitude(rawWest), wrapLongitude(rawEast)];
  return [south, west, north, east].map((value) => value.toFixed(5)).join(",");
}

/** Fit only once. Re-fitting after each viewport response would turn a pan into a jump. */
function FitInitialBounds({ points }: { points: WorldMapPoint[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current || points.length === 0) return;
    hasFitted.current = true;
    const coordinates = points.map((point) => [point.latitude, point.longitude] as L.LatLngTuple);
    if (coordinates.length === 1) {
      map.setView(coordinates[0], 10);
      return;
    }
    map.fitBounds(L.latLngBounds(coordinates), {
      padding: [42, 42],
      maxZoom: 11,
    });
  }, [map, points]);

  return null;
}

function ClusterLayer({ points }: { points: WorldMapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 80,
      chunkDelay: 32,
      showCoverageOnHover: false,
      maxClusterRadius: 42,
      spiderfyOnMaxZoom: true,
    });

    for (const point of points) {
      const marker = L.marker([point.latitude, point.longitude], {
        icon: markerIcon(point.category),
      });
      const cover = point.coverUrl
        ? `<img class="planet-popup-cover" src="${escapeHtml(point.coverUrl)}" alt="" loading="lazy" decoding="async" />`
        : "";
      marker.bindPopup(`
        <article class="planet-popup">
          ${cover}
          <p class="planet-popup-date">${escapeHtml(formatDate(point.happenedAt))}</p>
          <h3>${escapeHtml(point.title)}</h3>
          <p>${escapeHtml(point.placeName ?? "未命名地点")}</p>
          <a href="/memories/${encodeURIComponent(point.id)}">打开这段回忆</a>
        </article>
      `);
      group.addLayer(marker);
    }

    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      group.clearLayers();
    };
  }, [map, points]);

  return null;
}

type ViewportPointLoaderProps = {
  enabled: boolean;
  category?: "food";
  onPoints: (points: WorldMapPoint[]) => void;
  onError: (message: string | null) => void;
};

/**
 * Fetches only after a user pans or zooms. One in-flight request is allowed;
 * a newer viewport aborts the older one and matching bboxes are deduplicated.
 */
function ViewportPointLoader({
  enabled,
  category,
  onPoints,
  onError,
}: ViewportPointLoaderProps) {
  const map = useMap();
  const readyRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const activeRequestRef = useRef<
    { key: string; controller: AbortController } | undefined
  >(undefined);
  const lastCompletedKeyRef = useRef<string | undefined>(undefined);

  const requestViewport = useCallback(() => {
    if (!enabled || !readyRef.current) return;
    const bbox = viewportBbox(map);
    const key = `${category ?? "all"}:${bbox}`;
    if (
      lastCompletedKeyRef.current === key ||
      activeRequestRef.current?.key === key
    ) {
      return;
    }

    activeRequestRef.current?.controller.abort();
    const controller = new AbortController();
    activeRequestRef.current = { key, controller };
    const query = new URLSearchParams({ bbox });
    if (category) query.set("scope", category);

    void fetch(`/api/map-points?${query.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then((response) =>
        readApiJson<{ points?: unknown }>(response, "地点加载失败。"))
      .then((payload) => {
        if (
          controller.signal.aborted ||
          activeRequestRef.current?.controller !== controller
        ) {
          return;
        }
        onPoints(readPoints(payload.points));
        onError(null);
        lastCompletedKeyRef.current = key;
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        onError(error instanceof Error ? error.message : "地点加载失败，请稍后重试。");
      })
      .finally(() => {
        if (activeRequestRef.current?.controller === controller) {
          activeRequestRef.current = undefined;
        }
      });
  }, [category, enabled, map, onError, onPoints]);

  const scheduleRequest = useCallback(() => {
    if (!enabled || !readyRef.current) return;
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      requestViewport();
    }, MAP_REQUEST_DEBOUNCE_MS);
  }, [enabled, requestViewport]);

  useMapEvents({
    moveend: scheduleRequest,
    zoomend: scheduleRequest,
  });

  useEffect(() => {
    if (!enabled) return;
    lastCompletedKeyRef.current = undefined;
    // Leaflet emits move events while the initial server points are fitted.
    // They are intentionally not turned into a second, wide-world fetch.
    const initializationTimer = window.setTimeout(() => {
      readyRef.current = true;
    }, MAP_INITIALIZATION_DELAY_MS);
    return () => {
      readyRef.current = false;
      window.clearTimeout(initializationTimer);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      activeRequestRef.current?.controller.abort();
      activeRequestRef.current = undefined;
    };
  }, [enabled]);

  return null;
}

function buildRoutes(points: WorldMapPoint[]) {
  const chapters = new Map<string, WorldMapPoint[]>();
  for (const point of points) {
    if (!point.chapterId) continue;
    const list = chapters.get(point.chapterId) ?? [];
    list.push(point);
    chapters.set(point.chapterId, list);
  }
  return Array.from(chapters.values())
    .map((list) =>
      list
        .slice()
        .sort((a, b) => new Date(a.happenedAt).getTime() - new Date(b.happenedAt).getTime())
        .map((point) => [point.latitude, point.longitude] as L.LatLngTuple),
    )
    .filter((route) => route.length >= 2);
}

export default function LeafletWorldMap({
  points,
  height = "32rem",
  routeLabel = "虚线只表示事件发生的时间顺序，不代表真实行驶路线。",
  enableViewportLoading = false,
  category,
}: LeafletWorldMapProps) {
  const initialPoints = useMemo(() => points.filter(isValidPoint), [points]);
  const [visiblePoints, setVisiblePoints] = useState(initialPoints);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setVisiblePoints(initialPoints);
    setLoadError(null);
  }, [initialPoints]);

  const replaceVisiblePoints = useCallback((nextPoints: WorldMapPoint[]) => {
    setVisiblePoints(nextPoints.filter(isValidPoint));
  }, []);
  const routes = useMemo(() => buildRoutes(visiblePoints), [visiblePoints]);

  if (initialPoints.length === 0 && !enableViewportLoading) {
    return (
      <div className="world-map world-map-empty" style={{ minHeight: height }}>
        <p>还没有带地点的回忆。创建事件时填写地点坐标后，它会出现在这里。</p>
        <Link className="button-primary" href="/time/timeline?new=1">新增一条回忆</Link>
      </div>
    );
  }

  return (
    <div className="world-map-wrap">
      <MapContainer
        className="world-map"
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom
        worldCopyJump
        style={{ height }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitInitialBounds points={initialPoints} />
        <ViewportPointLoader
          enabled={enableViewportLoading}
          category={category}
          onPoints={replaceVisiblePoints}
          onError={setLoadError}
        />
        {routes.map((route, index) => (
          <Polyline
            key={`route-${index}`}
            pathOptions={{
              color: "var(--color-accent)",
              dashArray: "6 10",
              lineCap: "round",
              opacity: 0.72,
              weight: 3,
            }}
            positions={route}
          />
        ))}
        <ClusterLayer points={visiblePoints} />
      </MapContainer>
      {enableViewportLoading && (
        <p className="mt-3 text-xs text-muted">
          地点较多，拖动或缩放地图会按当前视野加载标记。
        </p>
      )}
      {loadError && (
        <p className="mt-2 text-xs text-[var(--color-rose)]" role="status">
          {loadError} 可再次移动地图重试。
        </p>
      )}
      <p className="mt-3 text-xs text-muted">{routeLabel}</p>
    </div>
  );
}
