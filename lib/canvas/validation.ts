import type {
  CanvasItemKind,
  CanvasItemPayload,
} from "../database.types";
import { CANVAS_STICKER_ASSET_KEYS } from "./stickers.ts";

export const CANVAS_MAX_ITEMS = 150;
export const CANVAS_MAX_STROKE_POINTS = 2_000;
export const CANVAS_MAX_PAYLOAD_BYTES = 64 * 1024;
const CANVAS_STROKE_POINT_RATIO_LIMIT = 16;

export const CANVAS_STROKE_COLOR_KEYS = [
  "coral",
  "berry",
  "amber",
  "sky",
  "mint",
  "ink",
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANCHOR_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]*$/;
const CREATE_KEYS = new Set([
  "id",
  "kind",
  "anchor_key",
  "x_ratio",
  "y_ratio",
  "width_ratio",
  "rotation",
  "opacity",
  "z_index",
  "payload",
]);
const PATCH_KEYS = new Set([
  "revision",
  "anchor_key",
  "x_ratio",
  "y_ratio",
  "width_ratio",
  "rotation",
  "opacity",
  "z_index",
  "payload",
]);

export class CanvasValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasValidationError";
  }
}

export type CanvasWritableFields = {
  anchorKey: string;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  payload: CanvasItemPayload;
};

export type ValidatedCanvasItemCreate = CanvasWritableFields & {
  id: string;
  kind: CanvasItemKind;
};

export type ValidatedCanvasItemPatch = Partial<CanvasWritableFields> & {
  revision: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new CanvasValidationError(`${label}格式不正确。`);
  }
  return value;
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
) {
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected) {
    throw new CanvasValidationError(`${label}包含不支持的字段：${unexpected}。`);
  }
}

function readNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
  integer = false,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (integer && !Number.isSafeInteger(value)) ||
    value < minimum ||
    value > maximum
  ) {
    throw new CanvasValidationError(
      `${label}必须是 ${minimum} 到 ${maximum} 之间的${integer ? "整数" : "数字"}。`,
    );
  }
  return value;
}

function readAnchorKey(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    !ANCHOR_KEY_PATTERN.test(value)
  ) {
    throw new CanvasValidationError("anchor_key 格式不正确。");
  }
  return value;
}

export function assertCanvasUuid(value: unknown, label = "ID") {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new CanvasValidationError(`${label}必须是有效的 UUID。`);
  }
  return value.toLowerCase();
}

export function getCanvasPayloadByteLength(value: unknown) {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new CanvasValidationError("payload 必须是可序列化的 JSON。");
  }
  if (serialized === undefined) {
    throw new CanvasValidationError("payload 必须是可序列化的 JSON。");
  }
  return new TextEncoder().encode(serialized).byteLength;
}

function assertPayloadSize(payload: unknown) {
  if (getCanvasPayloadByteLength(payload) > CANVAS_MAX_PAYLOAD_BYTES) {
    throw new CanvasValidationError("单个贴画的数据不能超过 64KB。");
  }
}

function validateStickerPayload(value: unknown): CanvasItemPayload {
  assertPayloadSize(value);
  const payload = readRecord(value, "贴纸 payload");
  assertOnlyKeys(payload, new Set(["assetKey"]), "贴纸 payload");
  if (
    typeof payload.assetKey !== "string" ||
    !CANVAS_STICKER_ASSET_KEYS.some((assetKey) => assetKey === payload.assetKey)
  ) {
    throw new CanvasValidationError("请选择内置贴纸，不能使用外部图片地址。");
  }
  return { assetKey: payload.assetKey };
}

function validateStrokePayload(value: unknown): CanvasItemPayload {
  assertPayloadSize(value);
  const payload = readRecord(value, "笔迹 payload");
  assertOnlyKeys(
    payload,
    new Set(["colorKey", "width", "points"]),
    "笔迹 payload",
  );
  if (
    typeof payload.colorKey !== "string" ||
    !CANVAS_STROKE_COLOR_KEYS.includes(
      payload.colorKey as (typeof CANVAS_STROKE_COLOR_KEYS)[number],
    )
  ) {
    throw new CanvasValidationError("画笔颜色不在允许范围内。");
  }
  const width = readNumber(payload.width, "画笔宽度", 1, 24);
  if (
    !Array.isArray(payload.points) ||
    payload.points.length < 1 ||
    payload.points.length > CANVAS_MAX_STROKE_POINTS
  ) {
    throw new CanvasValidationError("每一笔必须包含 1 到 2000 个采样点。");
  }
  const points = payload.points.map((rawPoint, index) => {
    const point = readRecord(rawPoint, `第 ${index + 1} 个采样点`);
    assertOnlyKeys(
      point,
      new Set(["x", "y", "pressure"]),
      `第 ${index + 1} 个采样点`,
    );
    const parsed = {
      x: readNumber(
        point.x,
        "采样点 x",
        -CANVAS_STROKE_POINT_RATIO_LIMIT,
        CANVAS_STROKE_POINT_RATIO_LIMIT,
      ),
      y: readNumber(
        point.y,
        "采样点 y",
        -CANVAS_STROKE_POINT_RATIO_LIMIT,
        CANVAS_STROKE_POINT_RATIO_LIMIT,
      ),
    } as { x: number; y: number; pressure?: number };
    if (point.pressure !== undefined) {
      parsed.pressure = readNumber(point.pressure, "采样点 pressure", 0, 1);
    }
    return parsed;
  });
  return { colorKey: payload.colorKey, width, points };
}

export function validateCanvasPayload(
  kind: CanvasItemKind,
  value: unknown,
): CanvasItemPayload {
  return kind === "sticker"
    ? validateStickerPayload(value)
    : validateStrokePayload(value);
}

function readWritableFields(
  value: Record<string, unknown>,
  kind: CanvasItemKind,
): CanvasWritableFields {
  return {
    anchorKey: readAnchorKey(value.anchor_key),
    xRatio: readNumber(value.x_ratio, "x_ratio", -0.5, 1.5),
    yRatio: readNumber(value.y_ratio, "y_ratio", -0.5, 1.5),
    widthRatio: readNumber(value.width_ratio, "width_ratio", 0.03, 1),
    rotation: readNumber(value.rotation, "rotation", -360, 360),
    opacity: readNumber(value.opacity, "opacity", 0.1, 1),
    zIndex: readNumber(value.z_index, "z_index", -10_000, 10_000, true),
    payload: validateCanvasPayload(kind, value.payload),
  };
}

export function validateCanvasItemCreate(
  value: unknown,
): ValidatedCanvasItemCreate {
  const input = readRecord(value, "画板元素");
  assertOnlyKeys(input, CREATE_KEYS, "画板元素");
  const kind = input.kind;
  if (kind !== "sticker" && kind !== "stroke") {
    throw new CanvasValidationError("kind 只能是 sticker 或 stroke。");
  }
  return {
    id: assertCanvasUuid(input.id, "画板元素 ID"),
    kind,
    ...readWritableFields(input, kind),
  };
}

export function validateCanvasItemPatch(
  value: unknown,
  kind: CanvasItemKind,
): ValidatedCanvasItemPatch {
  const input = readRecord(value, "画板更新");
  assertOnlyKeys(input, PATCH_KEYS, "画板更新");
  const revision = readNumber(input.revision, "revision", 1, 2_147_483_646, true);
  const patch: ValidatedCanvasItemPatch = { revision };

  if (input.anchor_key !== undefined) patch.anchorKey = readAnchorKey(input.anchor_key);
  if (input.x_ratio !== undefined) {
    patch.xRatio = readNumber(input.x_ratio, "x_ratio", -0.5, 1.5);
  }
  if (input.y_ratio !== undefined) {
    patch.yRatio = readNumber(input.y_ratio, "y_ratio", -0.5, 1.5);
  }
  if (input.width_ratio !== undefined) {
    patch.widthRatio = readNumber(input.width_ratio, "width_ratio", 0.03, 1);
  }
  if (input.rotation !== undefined) {
    patch.rotation = readNumber(input.rotation, "rotation", -360, 360);
  }
  if (input.opacity !== undefined) {
    patch.opacity = readNumber(input.opacity, "opacity", 0.1, 1);
  }
  if (input.z_index !== undefined) {
    patch.zIndex = readNumber(input.z_index, "z_index", -10_000, 10_000, true);
  }
  if (input.payload !== undefined) {
    patch.payload = validateCanvasPayload(kind, input.payload);
  }
  if (Object.keys(patch).length === 1) {
    throw new CanvasValidationError("没有提供要更新的画板字段。");
  }
  return patch;
}

export function validateCanvasRevision(value: unknown) {
  const input = readRecord(value, "删除请求");
  assertOnlyKeys(input, new Set(["revision"]), "删除请求");
  return readNumber(input.revision, "revision", 1, 2_147_483_646, true);
}

export function isCanvasRevisionConflict(
  currentRevision: number,
  expectedRevision: number,
) {
  return currentRevision !== expectedRevision;
}
