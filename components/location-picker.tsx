"use client";

import dynamic from "next/dynamic";
import { ExternalMapGate } from "@/components/external-map-gate";

export type LocationValue = {
  latitude: string;
  longitude: string;
};

type LocationPickerProps = {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

const LocationPickerLeaflet = dynamic(() => import("./location-picker-leaflet"), {
  ssr: false,
  loading: () => (
    <div className="location-picker-loading">
      正在加载地图…
    </div>
  ),
});

export function LocationPicker(props: LocationPickerProps) {
  return (
    <ExternalMapGate
      className="location-picker-loading"
      description="加载后，浏览器会向 OpenStreetMap 请求地图瓦片；若主服务不可用，还会请求 CARTO。它们会收到你的 IP 地址和正在查看的区域。"
    >
      <LocationPickerLeaflet {...props} />
    </ExternalMapGate>
  );
}
