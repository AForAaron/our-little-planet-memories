import type { CanvasPoint } from "../database.types";

export const ROOT_CANVAS_ANCHOR = "root";
export const CANVAS_STROKE_POINT_RATIO_LIMIT = 16;

export type CanvasAnchorMetric = {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

const EMPTY_ROOT_ANCHOR: CanvasAnchorMetric = {
  key: ROOT_CANVAS_ANCHOR,
  left: 0,
  top: 0,
  width: 1,
  height: 1,
};

export function resolveCanvasAnchor(
  anchors: Record<string, CanvasAnchorMetric>,
  requestedKey: string,
) {
  return anchors[requestedKey]
    ?? anchors[ROOT_CANVAS_ANCHOR]
    ?? EMPTY_ROOT_ANCHOR;
}

export function rootPointToAnchorRatio(
  point: { x: number; y: number },
  anchor: CanvasAnchorMetric,
) {
  return {
    x: (point.x - anchor.left) / Math.max(1, anchor.width),
    y: (point.y - anchor.top) / Math.max(1, anchor.height),
  };
}

export function anchorStrokePointToRoot(
  point: CanvasPoint,
  anchor: CanvasAnchorMetric,
  originXRatio: number,
  originYRatio: number,
) {
  return {
    x: anchor.left + originXRatio * anchor.width + point.x * anchor.width,
    y: anchor.top + originYRatio * anchor.height + point.y * anchor.width,
  };
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function compactPoint(point: CanvasPoint): CanvasPoint {
  const compacted: CanvasPoint = {
    x: round(point.x, 5),
    y: round(point.y, 5),
  };
  if (point.pressure !== undefined) {
    compacted.pressure = round(point.pressure, 3);
  }
  return compacted;
}

function pixelDistance(
  left: CanvasPoint,
  right: CanvasPoint,
  anchorWidth: number,
  anchorHeight: number,
) {
  return Math.hypot(
    (right.x - left.x) * Math.max(1, anchorWidth),
    (right.y - left.y) * Math.max(1, anchorHeight),
  );
}

/**
 * Removes sampling noise in anchor-relative coordinates while preserving both
 * endpoints. The final uniform cap keeps a single stroke comfortably below
 * the API's point and payload limits, even when a stylus reports pressure.
 */
export function simplifyCanvasPoints(
  points: CanvasPoint[],
  {
    anchorWidth,
    anchorHeight,
    minimumDistancePx = 2.5,
    maximumPoints = 1_000,
  }: {
    anchorWidth: number;
    anchorHeight: number;
    minimumDistancePx?: number;
    maximumPoints?: number;
  },
) {
  if (!points.length) return [];

  const simplified: CanvasPoint[] = [compactPoint(points[0])];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = compactPoint(points[index]);
    if (
      pixelDistance(
        simplified[simplified.length - 1],
        point,
        anchorWidth,
        anchorHeight,
      ) >= minimumDistancePx
    ) {
      simplified.push(point);
    }
  }

  const last = compactPoint(points[points.length - 1]);
  const currentLast = simplified[simplified.length - 1];
  if (
    points.length > 1
    && (currentLast.x !== last.x
      || currentLast.y !== last.y
      || currentLast.pressure !== last.pressure)
  ) {
    simplified.push(last);
  }

  const safeMaximum = Math.max(2, Math.floor(maximumPoints));
  if (simplified.length <= safeMaximum) return simplified;

  return Array.from({ length: safeMaximum }, (_, index) => {
    const sourceIndex = Math.round(
      index * (simplified.length - 1) / (safeMaximum - 1),
    );
    return simplified[sourceIndex];
  });
}
