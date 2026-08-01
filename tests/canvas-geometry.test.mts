import assert from "node:assert/strict";
import test from "node:test";
import {
  anchorStrokePointToLocalV2,
  anchorStrokePointToRoot,
  anchorStrokePointToRootV2,
  resolveCanvasAnchor,
  rootPointToAnchorRatio,
  simplifyCanvasPoints,
  type CanvasAnchorMetric,
} from "../lib/canvas/geometry.ts";

const root: CanvasAnchorMetric = {
  key: "root",
  left: 0,
  top: 0,
  width: 900,
  height: 1_800,
};

const body: CanvasAnchorMetric = {
  key: "body",
  left: 100,
  top: 400,
  width: 600,
  height: 300,
};

test("converts root coordinates into anchor-relative ratios", () => {
  assert.deepEqual(rootPointToAnchorRatio({ x: 250, y: 475 }, body), {
    x: 0.25,
    y: 0.25,
  });
});

test("falls back from a missing content anchor to the page root", () => {
  assert.equal(resolveCanvasAnchor({ root, body }, "follow-up:missing"), root);
  assert.deepEqual(resolveCanvasAnchor({}, "body"), {
    key: "root",
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  });
});

test("keeps stroke geometry proportional when an anchor changes aspect ratio", () => {
  const point = { x: 0.2, y: 0.2 };
  const desktop = anchorStrokePointToRoot(
    point,
    { key: "media", left: 0, top: 0, width: 900, height: 420 },
    0.1,
    0.25,
  );
  const mobile = anchorStrokePointToRoot(
    point,
    { key: "media", left: 0, top: 0, width: 320, height: 288 },
    0.1,
    0.25,
  );

  assert.equal(desktop.x - 90, desktop.y - 105);
  assert.equal(mobile.x - 32, mobile.y - 72);
});

test("v2 local points stay within 1% across desktop and mobile anchors", () => {
  const point = { x: 0.2, y: 0.15 };
  const originX = 0.1;
  const originY = 0.25;
  const desktopAnchor = { key: "body", left: 40, top: 80, width: 900, height: 600 };
  const mobileAnchor = { key: "body", left: 16, top: 64, width: 375, height: 800 };

  const desktop = anchorStrokePointToRootV2(point, desktopAnchor, originX, originY);
  const mobile = anchorStrokePointToRootV2(point, mobileAnchor, originX, originY);
  const desktopLocal = {
    x: (desktop.x - desktopAnchor.left) / desktopAnchor.width,
    y: (desktop.y - desktopAnchor.top) / desktopAnchor.height,
  };
  const mobileLocal = {
    x: (mobile.x - mobileAnchor.left) / mobileAnchor.width,
    y: (mobile.y - mobileAnchor.top) / mobileAnchor.height,
  };
  const expected = anchorStrokePointToLocalV2(point, originX, originY);

  assert.ok(Math.abs(desktopLocal.x - expected.x) < 0.01);
  assert.ok(Math.abs(desktopLocal.y - expected.y) < 0.01);
  assert.ok(Math.abs(mobileLocal.x - expected.x) < 0.01);
  assert.ok(Math.abs(mobileLocal.y - expected.y) < 0.01);
  assert.ok(Math.abs(desktopLocal.x - mobileLocal.x) < 0.01);
  assert.ok(Math.abs(desktopLocal.y - mobileLocal.y) < 0.01);
});

test("thins dense strokes, rounds payload values, and preserves endpoints", () => {
  const points = Array.from({ length: 101 }, (_, index) => ({
    x: index / 1_000 + 0.00000019,
    y: index / 2_000 + 0.00000019,
    pressure: 0.56789,
  }));
  const result = simplifyCanvasPoints(points, {
    anchorWidth: 600,
    anchorHeight: 300,
    minimumDistancePx: 8,
  });

  assert.ok(result.length < points.length);
  assert.deepEqual(result[0], { x: 0, y: 0, pressure: 0.568 });
  assert.deepEqual(result.at(-1), { x: 0.1, y: 0.05, pressure: 0.568 });
});

test("caps very long strokes without losing their first or last point", () => {
  const points = Array.from({ length: 40 }, (_, index) => ({
    x: index / 39,
    y: index / 39,
  }));
  const result = simplifyCanvasPoints(points, {
    anchorWidth: 1_000,
    anchorHeight: 1_000,
    minimumDistancePx: 0,
    maximumPoints: 8,
  });

  assert.equal(result.length, 8);
  assert.deepEqual(result[0], { x: 0, y: 0 });
  assert.deepEqual(result.at(-1), { x: 1, y: 1 });
});
