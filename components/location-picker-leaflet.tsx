"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
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
  const position = useMemo(() => {
    const latitude = parseCoordinate(value.latitude);
    const longitude = parseCoordinate(value.longitude);
    if (latitude == null || longitude == null) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return [latitude, longitude] as L.LatLngTuple;
  }, [value.latitude, value.longitude]);

  const fallbackCenter: L.LatLngTuple = [31.2304, 121.4737];

  return (
    <div className="location-picker">
      <MapContainer
        className="location-picker-map"
        center={position ?? fallbackCenter}
        zoom={position ? 13 : 4}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onChange={onChange} />
        <Recenter position={position} />
        {position && <Marker position={position} icon={markerIcon()} />}
      </MapContainer>
      <p className="mt-2 text-xs leading-5 text-muted">
        点击地图上的位置即可填写坐标；这里只选择坐标，不会自动把你的私密坐标发送给地理编码服务。
      </p>
    </div>
  );
}
