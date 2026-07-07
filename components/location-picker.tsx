"use client";

import dynamic from "next/dynamic";

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
  return <LocationPickerLeaflet {...props} />;
}
