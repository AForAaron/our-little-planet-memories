"use client";

import dynamic from "next/dynamic";

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
  return <LeafletWorldMap {...props} />;
}
