"use client";

import dynamic from "next/dynamic";
import { ExternalMapGate } from "@/components/external-map-gate";

export type WorldMapPoint = {
  id: string;
  title: string;
  happenedAt: string;
  latitude: number;
  longitude: number;
  category: string;
  placeName: string | null;
  chapterId: string | null;
  coverUrl: string | null;
};

type WorldMapProps = {
  points: WorldMapPoint[];
  height?: string;
  routeLabel?: string;
  /** Initial server query was capped; load the current viewport after movement. */
  enableViewportLoading?: boolean;
  category?: "food";
};

const LeafletWorldMap = dynamic(() => import("./world-map-leaflet"), {
  ssr: false,
  loading: () => (
    <div className="world-map world-map-loading">
      <span>正在唤醒小星球地图…</span>
    </div>
  ),
});

export function WorldMap(props: WorldMapProps) {
  if (props.points.length === 0 && !props.enableViewportLoading) {
    return <LeafletWorldMap {...props} />;
  }

  return (
    <ExternalMapGate
      className="world-map world-map-loading"
      description="加载后，浏览器会向 OpenStreetMap 请求地图瓦片，对方会收到你的 IP 地址和正在查看的区域。"
      style={{ minHeight: props.height ?? "32rem" }}
    >
      <LeafletWorldMap {...props} />
    </ExternalMapGate>
  );
}
