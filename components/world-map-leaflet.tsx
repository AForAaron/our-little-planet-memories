"use client";

import L from "leaflet";
import "leaflet.markercluster";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import type { WorldMapPoint } from "./world-map";

type LeafletWorldMapProps = {
  points: WorldMapPoint[];
  height?: string;
  routeLabel?: string;
};

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
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

function FitBounds({ points }: { points: WorldMapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    const coordinates = points.map((point) => [point.latitude, point.longitude] as L.LatLngTuple);
    if (coordinates.length === 0) {
      map.setView([20, 0], 2);
      return;
    }
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
      showCoverageOnHover: false,
      maxClusterRadius: 42,
      spiderfyOnMaxZoom: true,
    });

    for (const point of points) {
      const marker = L.marker([point.latitude, point.longitude], {
        icon: markerIcon(point.category),
      });
      const cover = point.coverUrl
        ? `<img class="planet-popup-cover" src="${escapeHtml(point.coverUrl)}" alt="" />`
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
}: LeafletWorldMapProps) {
  const validPoints = useMemo(
    () =>
      points.filter(
        (point) =>
          Number.isFinite(point.latitude) &&
          Number.isFinite(point.longitude) &&
          Math.abs(point.latitude) <= 90 &&
          Math.abs(point.longitude) <= 180,
      ),
    [points],
  );
  const routes = useMemo(() => buildRoutes(validPoints), [validPoints]);

  if (validPoints.length === 0) {
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
        {routes.map((route, index) => (
          <Polyline
            key={`route-${index}`}
            pathOptions={{
              color: "#f58c7b",
              dashArray: "6 10",
              lineCap: "round",
              opacity: 0.72,
              weight: 3,
            }}
            positions={route}
          />
        ))}
        <ClusterLayer points={validPoints} />
        <FitBounds points={validPoints} />
      </MapContainer>
      <p className="mt-3 text-xs text-muted">{routeLabel}</p>
    </div>
  );
}
