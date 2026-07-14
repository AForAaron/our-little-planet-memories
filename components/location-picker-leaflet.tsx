"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LocationValue } from "./location-picker";

type LocationPickerLeafletProps = {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

function markerIcon() {
  return L.divIcon({
    className: "",
    html: '<span class="planet-marker is-trip" aria-hidden="true"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function parseCoordinate(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function MapClickHandler({
  onChange,
}: {
  onChange: LocationPickerLeafletProps["onChange"];
}) {
  useMapEvents({
    click(event) {
      onChange({
        latitude: event.latlng.lat.toFixed(6),
        longitude: event.latlng.lng.toFixed(6),
      });
    },
  });
  return null;
}

function Recenter({ position }: { position: L.LatLngTuple | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 12));
  }, [map, position]);
  return null;
}

export default function LocationPickerLeaflet({
  value,
  onChange,
}: LocationPickerLeafletProps) {
  const [tileSourceIndex, setTileSourceIndex] = useState(0);
  const [tileWarning, setTileWarning] = useState("");
  const position = useMemo(() => {
    const latitude = parseCoordinate(value.latitude);
    const longitude = parseCoordinate(value.longitude);
    if (latitude == null || longitude == null) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return [latitude, longitude] as L.LatLngTuple;
  }, [value.latitude, value.longitude]);

  const fallbackCenter: L.LatLngTuple = [31.2304, 121.4737];
  const tileSources = [
    {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  ];
  const tileSource = tileSources[tileSourceIndex] ?? tileSources[0];

  return (
    <div className="location-picker">
      <MapContainer
        className="location-picker-map"
        center={position ?? fallbackCenter}
        zoom={position ? 13 : 4}
        scrollWheelZoom
      >
        <TileLayer
          attribution={tileSource.attribution}
          eventHandlers={{
            tileerror: () => {
              setTileWarning("底图加载不稳定，已尝试切换备用底图；如果仍是蓝底，通常是当前网络阻止了地图瓦片请求。");
              setTileSourceIndex((current) => Math.min(current + 1, tileSources.length - 1));
            },
          }}
          url={tileSource.url}
        />
        <MapClickHandler onChange={onChange} />
        <Recenter position={position} />
        {position && <Marker position={position} icon={markerIcon()} />}
      </MapContainer>
      {tileWarning && (
        <p className="mt-2 rounded-soft bg-[var(--color-amber-soft)] p-3 text-xs leading-5 text-[var(--color-amber)]">
          {tileWarning}
        </p>
      )}
      <p className="mt-2 text-xs leading-5 text-muted">
        点击地图上的位置即可填写坐标；这里只选择坐标，不会自动把你的私密坐标发送给地理编码服务。
      </p>
    </div>
  );
}
