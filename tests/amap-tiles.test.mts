import assert from "node:assert/strict";
import test from "node:test";
import { amapTileSources } from "../lib/maps/amap-tiles.ts";

test("formal map tiles use Amap only", () => {
  assert.equal(amapTileSources.length >= 1, true);
  for (const source of amapTileSources) {
    assert.match(source.url, /autonavi\.com/);
    assert.equal(/openstreetmap|cartocdn/i.test(source.url), false);
  }
});
