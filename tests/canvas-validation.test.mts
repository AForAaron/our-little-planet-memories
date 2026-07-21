import assert from "node:assert/strict";
import test from "node:test";
import {
  CANVAS_MAX_PAYLOAD_BYTES,
  CANVAS_MAX_STROKE_POINTS,
  CanvasValidationError,
  getCanvasPayloadByteLength,
  isCanvasRevisionConflict,
  validateCanvasItemCreate,
  validateCanvasItemPatch,
  validateCanvasRevision,
} from "../lib/canvas/validation.ts";

const ITEM_ID = "9cfa84a2-665f-4bb0-9484-395a96209e11";

function stickerInput(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    kind: "sticker",
    anchor_key: "media:6bb7c52b-5ead-4b73-8197-b39c88c476e1",
    x_ratio: 0.25,
    y_ratio: 0.75,
    width_ratio: 0.18,
    rotation: -12,
    opacity: 0.9,
    z_index: 4,
    payload: { assetKey: "cat" },
    ...overrides,
  };
}

test("accepts a client UUID and sanitizes an internal sticker", () => {
  assert.deepEqual(validateCanvasItemCreate(stickerInput()), {
    id: ITEM_ID,
    kind: "sticker",
    anchorKey: "media:6bb7c52b-5ead-4b73-8197-b39c88c476e1",
    xRatio: 0.25,
    yRatio: 0.75,
    widthRatio: 0.18,
    rotation: -12,
    opacity: 0.9,
    zIndex: 4,
    payload: { assetKey: "cat" },
  });
});

test("accepts bounded vector strokes with optional pressure", () => {
  const result = validateCanvasItemCreate(
    stickerInput({
      kind: "stroke",
      anchor_key: "body",
      payload: {
        colorKey: "berry",
        width: 6,
        points: [
          { x: -0.1, y: 0.2 },
          { x: 1.1, y: 0.9, pressure: 0.65 },
        ],
      },
    }),
  );
  assert.equal(result.kind, "stroke");
  assert.deepEqual(result.payload, {
    colorKey: "berry",
    width: 6,
    points: [
      { x: -0.1, y: 0.2 },
      { x: 1.1, y: 0.9, pressure: 0.65 },
    ],
  });
});

test("rejects external sticker resources and unsafe anchor keys", () => {
  assert.throws(
    () => validateCanvasItemCreate(stickerInput({ payload: { assetKey: "https://example.com/cat.svg" } })),
    CanvasValidationError,
  );
  assert.throws(
    () => validateCanvasItemCreate(stickerInput({ anchor_key: "body<script>" })),
    CanvasValidationError,
  );
});

test("rejects out-of-range layout values and non-finite numbers", () => {
  for (const overrides of [
    { x_ratio: -0.5001 },
    { y_ratio: 1.5001 },
    { width_ratio: 0.02 },
    { rotation: Number.POSITIVE_INFINITY },
    { opacity: 0 },
    { z_index: 1.5 },
  ]) {
    assert.throws(
      () => validateCanvasItemCreate(stickerInput(overrides)),
      CanvasValidationError,
    );
  }
});

test("caps stroke point count and serialized payload size", () => {
  assert.throws(
    () =>
      validateCanvasItemCreate(
        stickerInput({
          kind: "stroke",
          payload: {
            colorKey: "ink",
            width: 3,
            points: Array.from(
              { length: CANVAS_MAX_STROKE_POINTS + 1 },
              () => ({ x: 0, y: 0 }),
            ),
          },
        }),
      ),
    CanvasValidationError,
  );

  const oversized = { assetKey: "x".repeat(CANVAS_MAX_PAYLOAD_BYTES) };
  assert.ok(getCanvasPayloadByteLength(oversized) > CANVAS_MAX_PAYLOAD_BYTES);
  assert.throws(
    () => validateCanvasItemCreate(stickerInput({ payload: oversized })),
    /64KB/,
  );
});

test("allows long anchored strokes but rejects unbounded point ratios", () => {
  assert.doesNotThrow(() => validateCanvasItemCreate(
    stickerInput({
      kind: "stroke",
      payload: {
        colorKey: "ink",
        width: 3,
        points: [{ x: 0, y: 12 }],
      },
    }),
  ));
  assert.throws(
    () => validateCanvasItemCreate(
      stickerInput({
        kind: "stroke",
        payload: {
          colorKey: "ink",
          width: 3,
          points: [{ x: 0, y: 16.01 }],
        },
      }),
    ),
    CanvasValidationError,
  );
});

test("requires a positive revision and at least one patch field", () => {
  assert.deepEqual(
    validateCanvasItemPatch({ revision: 3, rotation: 45 }, "sticker"),
    { revision: 3, rotation: 45 },
  );
  assert.throws(
    () => validateCanvasItemPatch({ revision: 0, rotation: 45 }, "sticker"),
    CanvasValidationError,
  );
  assert.throws(
    () => validateCanvasItemPatch({ revision: 3 }, "sticker"),
    /没有提供/,
  );
  assert.equal(validateCanvasRevision({ revision: 7 }), 7);
  assert.throws(
    () => validateCanvasRevision({ revision: 7, id: ITEM_ID }),
    CanvasValidationError,
  );
});

test("detects optimistic revision conflicts before a write", () => {
  assert.equal(isCanvasRevisionConflict(4, 4), false);
  assert.equal(isCanvasRevisionConflict(5, 4), true);
});
