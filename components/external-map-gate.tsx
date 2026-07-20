"use client";

import { Map } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

type ExternalMapGateProps = {
  children: ReactNode;
  className: string;
  description: string;
  style?: CSSProperties;
};

export function ExternalMapGate({
  children,
  className,
  description,
  style,
}: ExternalMapGateProps) {
  const [enabled, setEnabled] = useState(false);

  if (enabled) return <>{children}</>;

  return (
    <div className={className} style={style}>
      <div className="external-map-gate">
        <Map size={24} aria-hidden="true" />
        <p>{description}</p>
        <button
          type="button"
          className="button-secondary"
          onClick={() => setEnabled(true)}
        >
          <Map size={16} aria-hidden="true" />
          加载外部地图
        </button>
      </div>
    </div>
  );
}
