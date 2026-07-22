"use client";

import {
  ArrowDown,
  ArrowUp,
  Brush,
  Eraser,
  Eye,
  EyeOff,
  MousePointer2,
  Palette,
  Redo2,
  RotateCw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVisibilityAwarePolling } from "@/components/use-visibility-aware-polling";
import {
  CANVAS_STROKE_POINT_RATIO_LIMIT,
  ROOT_CANVAS_ANCHOR,
  anchorStrokePointToRoot,
  resolveCanvasAnchor,
  rootPointToAnchorRatio,
  simplifyCanvasPoints,
  type CanvasAnchorMetric,
} from "@/lib/canvas/geometry";
import {
  CANVAS_STICKERS,
  CANVAS_STICKER_SHEETS,
  getCanvasStickerDefinition,
  type CanvasStickerDefinition,
} from "@/lib/canvas/stickers";
import type {
  EntryCanvasItem,
  StickerPayload,
  StrokePayload,
} from "@/lib/database.types";
import { readApiJson } from "@/lib/http/read-api-json";
import styles from "./memory-canvas-shell.module.css";

const MAX_HISTORY = 40;
const MAX_RAW_STROKE_POINTS = 2_000;
const POLL_INTERVAL_MS = 15_000;
const ROOT_ANCHOR = ROOT_CANVAS_ANCHOR;

type Tool = "select" | "sticker" | "brush" | "eraser";
type SaveState = "idle" | "saving" | "saved" | "conflict" | "error";

type Point = StrokePayload["points"][number];

type StrokeColor = {
  key: string;
  label: string;
  value: string;
};

type ItemGesture = {
  kind: "move" | "resize" | "rotate";
  pointerId: number;
  itemId: string;
  before: EntryCanvasItem[];
  original: EntryCanvasItem;
  startClientX: number;
  startClientY: number;
  startAngle?: number;
  centerClientX?: number;
  centerClientY?: number;
};

type PlacementGesture = {
  kind: "place";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
};

type Gesture = ItemGesture | PlacementGesture;

type DraftStroke = {
  anchorKey: string;
  pointerId: number;
  originXRatio: number;
  originYRatio: number;
  points: Point[];
};

type CanvasResponse = { items?: EntryCanvasItem[] };
type CanvasItemResponse = { item?: EntryCanvasItem };

const STROKE_COLORS: StrokeColor[] = [
  { key: "coral", label: "珊瑚橙", value: "#fa855a" },
  { key: "berry", label: "莓果红", value: "#c93638" },
  { key: "amber", label: "蜂蜜黄", value: "#d08e35" },
  { key: "sky", label: "天空蓝", value: "#4baec5" },
  { key: "mint", label: "薄荷绿", value: "#5c9278" },
  { key: "ink", label: "铅笔灰", value: "#3f5057" },
];

const COLOR_BY_KEY = new Map(STROKE_COLORS.map((item) => [item.key, item.value]));

function createId() {
  const webCrypto = typeof globalThis !== "undefined"
    ? (globalThis.crypto as {
        randomUUID?: () => string;
        getRandomValues?: (array: Uint8Array) => Uint8Array;
      } | undefined)
    : undefined;
  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${
    value.slice(16, 20)
  }-${value.slice(20)}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeRotation(value: number) {
  let normalized = value % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
}

function nowIso() {
  return new Date().toISOString();
}

function stickerPayload(item: EntryCanvasItem) {
  return item.payload as StickerPayload;
}

function strokePayload(item: EntryCanvasItem) {
  return item.payload as StrokePayload;
}

function mutableItem(item: EntryCanvasItem) {
  return {
    anchor_key: item.anchor_key,
    x_ratio: item.x_ratio,
    y_ratio: item.y_ratio,
    width_ratio: item.width_ratio,
    rotation: item.rotation,
    opacity: item.opacity,
    z_index: item.z_index,
    payload: item.payload,
  };
}

function createBody(item: EntryCanvasItem) {
  return {
    id: item.id,
    kind: item.kind,
    ...mutableItem(item),
  };
}

function mutableItemsEqual(left: EntryCanvasItem, right: EntryCanvasItem) {
  return JSON.stringify(mutableItem(left)) === JSON.stringify(mutableItem(right));
}

function snapshotsEqual(left: EntryCanvasItem[], right: EntryCanvasItem[]) {
  if (left.length !== right.length) return false;
  const rightById = new Map(right.map((item) => [item.id, item]));
  return left.every((item) => {
    const match = rightById.get(item.id);
    return Boolean(match && mutableItemsEqual(item, match));
  });
}

function anchorsEqual(
  left: Record<string, CanvasAnchorMetric>,
  right: Record<string, CanvasAnchorMetric>,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => {
    const a = left[key];
    const b = right[key];
    return Boolean(
      b
      && Math.abs(a.left - b.left) < 0.5
      && Math.abs(a.top - b.top) < 0.5
      && Math.abs(a.width - b.width) < 0.5
      && Math.abs(a.height - b.height) < 0.5,
    );
  });
}

function stickerStyle(definition: CanvasStickerDefinition): CSSProperties {
  const sheet = CANVAS_STICKER_SHEETS[definition.sheetKey];
  const x = sheet.columns > 1
    ? definition.column * (100 / (sheet.columns - 1))
    : 0;
  const y = sheet.rows > 1
    ? definition.row * (100 / (sheet.rows - 1))
    : 0;
  return {
    "--sticker-image": `url("${sheet.src}")`,
    "--sticker-size-x": `${sheet.columns * 100}%`,
    "--sticker-size-y": `${sheet.rows * 100}%`,
    "--sticker-x": `${x}%`,
    "--sticker-y": `${y}%`,
  } as CSSProperties;
}

function pathForPoints(
  points: Point[],
  anchor: CanvasAnchorMetric,
  originXRatio: number,
  originYRatio: number,
) {
  if (!points.length) return "";
  const resolved = points.map((point) => anchorStrokePointToRoot(
    point,
    anchor,
    originXRatio,
    originYRatio,
  ));
  if (resolved.length === 1) {
    const point = resolved[0];
    return `M ${point.x} ${point.y} l 0.01 0.01`;
  }
  if (resolved.length === 2) {
    return `M ${resolved[0].x} ${resolved[0].y} L ${resolved[1].x} ${resolved[1].y}`;
  }
  let path = `M ${resolved[0].x} ${resolved[0].y}`;
  for (let index = 1; index < resolved.length - 1; index += 1) {
    const point = resolved[index];
    const next = resolved[index + 1];
    const midpointX = (point.x + next.x) / 2;
    const midpointY = (point.y + next.y) / 2;
    path += ` Q ${point.x} ${point.y} ${midpointX} ${midpointY}`;
  }
  const last = resolved[resolved.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

const CanvasStrokeItem = memo(function CanvasStrokeItem({
  item,
  anchor,
  canvasSize,
  editing,
  decorationsVisible,
  tool,
  selected,
  onPointerDown,
  onSelect,
}: {
  item: EntryCanvasItem;
  anchor: CanvasAnchorMetric;
  canvasSize: CanvasAnchorMetric;
  editing: boolean;
  decorationsVisible: boolean;
  tool: Tool;
  selected: boolean;
  onPointerDown: (
    event: ReactPointerEvent<HTMLElement | SVGPathElement>,
    item: EntryCanvasItem,
  ) => void;
  onSelect: (id: string) => void;
}) {
  const payload = strokePayload(item);
  const path = useMemo(() => pathForPoints(
    payload.points,
    anchor,
    item.x_ratio,
    item.y_ratio,
  ), [anchor, item.x_ratio, item.y_ratio, payload.points]);
  const strokeColor = COLOR_BY_KEY.get(payload.colorKey) ?? COLOR_BY_KEY.get("coral")!;

  return (
    <svg
      className={styles.strokeLayer}
      viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
      preserveAspectRatio="none"
      style={{ zIndex: item.z_index, opacity: item.opacity }}
      aria-hidden={editing && decorationsVisible && tool === "select"
        ? undefined
        : true}
    >
      {editing && selected && (
        <path
          d={path}
          fill="none"
          stroke="var(--color-on-accent)"
          strokeWidth={payload.width + 6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.strokeSelection}
        />
      )}
      {editing && decorationsVisible && (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(payload.width, 28)}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={styles.interactiveStroke}
          onPointerDown={(event) => onPointerDown(event, item)}
          onFocus={() => onSelect(item.id)}
          role={tool === "select" ? "button" : undefined}
          aria-label={tool === "select" ? "一笔画" : undefined}
          tabIndex={tool === "select" ? 0 : -1}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={payload.width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

function keyboardTargetIsEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"),
  );
}

function itemZRange(items: EntryCanvasItem[]) {
  if (!items.length) return { minimum: 0, maximum: 0 };
  return items.reduce(
    (range, item) => ({
      minimum: Math.min(range.minimum, item.z_index),
      maximum: Math.max(range.maximum, item.z_index),
    }),
    { minimum: items[0].z_index, maximum: items[0].z_index },
  );
}

export function MemoryCanvasShell({
  entryId,
  initialItems = [],
  isDemo = false,
  children,
}: {
  entryId: string;
  initialItems?: EntryCanvasItem[];
  isDemo?: boolean;
  children: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<EntryCanvasItem[]>(initialItems);
  const anchorsRef = useRef<Record<string, CanvasAnchorMetric>>({});
  const gestureRef = useRef<Gesture | null>(null);
  const draftRef = useRef<DraftStroke | null>(null);
  const opacityBeforeRef = useRef<EntryCanvasItem[] | null>(null);
  const undoRef = useRef<EntryCanvasItem[][]>([]);
  const redoRef = useRef<EntryCanvasItem[][]>([]);
  const knownRevisionRef = useRef(new Map<string, number>());
  const pendingWritesRef = useRef(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const writeEpochRef = useRef(0);
  const localChangeVersionRef = useRef(0);
  const loadRequestIdRef = useRef(0);
  const conflictSyncingRef = useRef(false);
  const mountedRef = useRef(true);

  const [items, setItems] = useState<EntryCanvasItem[]>(initialItems);
  const [anchors, setAnchors] = useState<Record<string, CanvasAnchorMetric>>({});
  const [editing, setEditing] = useState(false);
  const [decorationsVisible, setDecorationsVisible] = useState(true);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAssetKey, setSelectedAssetKey] = useState<string>(
    CANVAS_STICKERS[0].assetKey,
  );
  const [colorKey, setColorKey] = useState(STROKE_COLORS[0].key);
  const [brushWidth, setBrushWidth] = useState(6);
  const [draftStroke, setDraftStroke] = useState<DraftStroke | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [notice, setNotice] = useState("");
  const [conflictSyncing, setConflictSyncing] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const setItemsImmediately = useCallback(
    (next: EntryCanvasItem[] | ((current: EntryCanvasItem[]) => EntryCanvasItem[])) => {
      const resolved = typeof next === "function" ? next(itemsRef.current) : next;
      itemsRef.current = resolved;
      setItems(resolved);
    },
    [],
  );

  const recordHistory = useCallback((before: EntryCanvasItem[]) => {
    if (snapshotsEqual(before, itemsRef.current)) return;
    undoRef.current = [...undoRef.current.slice(-(MAX_HISTORY - 1)), before];
    redoRef.current = [];
    setHistoryVersion((version) => version + 1);
  }, []);

  const anchorForKey = useCallback((key: string) => {
    return resolveCanvasAnchor(anchorsRef.current, key);
  }, []);

  const anchorAtClientPoint = useCallback((clientX: number, clientY: number) => {
    const surface = surfaceRef.current;
    if (!surface) return ROOT_ANCHOR;
    const surfaceRect = surface.getBoundingClientRect();
    const localX = clientX - surfaceRect.left;
    const localY = clientY - surfaceRect.top;
    const candidates = Object.values(anchorsRef.current)
      .filter((anchor) => (
        anchor.key !== ROOT_ANCHOR
        && localX >= anchor.left
        && localX <= anchor.left + anchor.width
        && localY >= anchor.top
        && localY <= anchor.top + anchor.height
      ))
      .sort((left, right) => left.width * left.height - right.width * right.height);
    return candidates[0]?.key ?? ROOT_ANCHOR;
  }, []);

  const keepStickerReachable = useCallback((
    item: EntryCanvasItem,
    xRatio: number,
    yRatio: number,
  ) => {
    const surface = surfaceRef.current;
    const anchor = anchorForKey(item.anchor_key);
    if (!surface) {
      return {
        x_ratio: clamp(xRatio, -0.5, 1.5),
        y_ratio: clamp(yRatio, -0.5, 1.5),
      };
    }
    const width = item.width_ratio * anchor.width;
    const visibleGrip = Math.min(28, Math.max(12, width / 2));
    const rootWidth = Math.max(1, surface.getBoundingClientRect().width);
    const rootHeight = Math.max(1, surface.getBoundingClientRect().height);
    const minimumX = Math.max(
      -0.5,
      (-width + visibleGrip - anchor.left) / anchor.width,
    );
    const maximumX = Math.min(
      1.5,
      (rootWidth - visibleGrip - anchor.left) / anchor.width,
    );
    const minimumY = Math.max(
      -0.5,
      (-width + visibleGrip - anchor.top) / anchor.height,
    );
    const maximumY = Math.min(
      1.5,
      (rootHeight - visibleGrip - anchor.top) / anchor.height,
    );
    return {
      x_ratio: minimumX <= maximumX
        ? clamp(xRatio, minimumX, maximumX)
        : clamp(xRatio, -0.5, 1.5),
      y_ratio: minimumY <= maximumY
        ? clamp(yRatio, minimumY, maximumY)
        : clamp(yRatio, -0.5, 1.5),
    };
  }, [anchorForKey]);

  const refreshAnchors = useCallback(() => {
    const surface = surfaceRef.current;
    const content = contentRef.current;
    if (!surface || !content) return;
    const surfaceRect = surface.getBoundingClientRect();
    const next: Record<string, CanvasAnchorMetric> = {
      [ROOT_ANCHOR]: {
        key: ROOT_ANCHOR,
        left: 0,
        top: 0,
        width: Math.max(1, surfaceRect.width),
        height: Math.max(1, surfaceRect.height),
      },
    };
    content.querySelectorAll<HTMLElement>("[data-canvas-anchor]").forEach((element) => {
      const key = element.dataset.canvasAnchor?.trim();
      if (!key || key === ROOT_ANCHOR || next[key]) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      next[key] = {
        key,
        left: rect.left - surfaceRect.left,
        top: rect.top - surfaceRect.top,
        width: rect.width,
        height: rect.height,
      };
    });
    anchorsRef.current = next;
    setAnchors((current) => anchorsEqual(current, next) ? current : next);
  }, []);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const content = contentRef.current;
    if (!surface || !content) return;
    let frame = 0;
    const scheduleRefresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(refreshAnchors);
    };
    const resizeObserver = new ResizeObserver(scheduleRefresh);
    const observeAnchors = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(surface);
      resizeObserver.observe(content);
      content.querySelectorAll<HTMLElement>("[data-canvas-anchor]").forEach((element) => {
        resizeObserver.observe(element);
      });
      scheduleRefresh();
    };
    const mutationObserver = new MutationObserver(observeAnchors);
    mutationObserver.observe(content, { childList: true, subtree: true });
    observeAnchors();
    window.addEventListener("resize", scheduleRefresh);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleRefresh);
    };
  }, [refreshAnchors]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    for (const item of initialItems) {
      knownRevisionRef.current.set(item.id, item.revision);
    }
  }, [initialItems]);

  useEffect(() => {
    if (!editing) return;
    const companion = document.querySelector<HTMLElement>(".companion");
    if (!companion) return;
    const previousVisibility = companion.style.visibility;
    const previousPointerEvents = companion.style.pointerEvents;
    companion.style.visibility = "hidden";
    companion.style.pointerEvents = "none";
    return () => {
      companion.style.visibility = previousVisibility;
      companion.style.pointerEvents = previousPointerEvents;
    };
  }, [editing]);

  const loadItems = useCallback(async (signal?: AbortSignal, force = false) => {
    if (isDemo || (!force && pendingWritesRef.current > 0)) return false;
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    const localChangeVersion = localChangeVersionRef.current;
    const response = await fetch(`/api/entries/${entryId}/canvas-items`, {
      cache: "no-store",
      signal,
    });
    const result = await readApiJson<CanvasResponse>(response, "贴画同步失败。");
    if (
      !result.items
      || requestId !== loadRequestIdRef.current
      || localChangeVersion !== localChangeVersionRef.current
      || (!force && pendingWritesRef.current > 0)
      || gestureRef.current
      || draftRef.current
      || opacityBeforeRef.current
    ) {
      return false;
    }
    const changed = !snapshotsEqual(itemsRef.current, result.items);
    knownRevisionRef.current.clear();
    for (const item of result.items) {
      knownRevisionRef.current.set(item.id, item.revision);
    }
    if (changed) {
      // History snapshots describe a specific shared board. Keeping them after
      // an external refresh would let Undo delete or overwrite the other
      // person's newly synchronized work.
      undoRef.current = [];
      redoRef.current = [];
      setHistoryVersion((version) => version + 1);
    }
    setItemsImmediately(result.items);
    setSelectedId((current) => result.items!.some((item) => item.id === current) ? current : null);
    return true;
  }, [entryId, isDemo, setItemsImmediately]);

  const refreshNow = useVisibilityAwarePolling({
    enabled: !isDemo,
    intervalMs: POLL_INTERVAL_MS,
    refreshKey: entryId,
    task: async (signal) => {
      await loadItems(signal);
    },
  });

  useEffect(() => {
    if (isDemo) return;
    const onFocus = () => refreshNow();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isDemo, refreshNow]);

  const handleWriteFailure = useCallback(async (caught: unknown) => {
    if (!mountedRef.current) return;
    // Every queued write after this failure was derived from the same stale
    // snapshot. Dropping that tail prevents it from overwriting a revision we
    // are about to reload after a 409.
    writeEpochRef.current += 1;
    if (caught instanceof Error && caught.message === "canvas-conflict") {
      conflictSyncingRef.current = true;
      setConflictSyncing(true);
      const activeGesture = gestureRef.current;
      if (activeGesture && activeGesture.kind !== "place") {
        setItemsImmediately(activeGesture.before);
      } else if (opacityBeforeRef.current) {
        setItemsImmediately(opacityBeforeRef.current);
      }
      gestureRef.current = null;
      draftRef.current = null;
      opacityBeforeRef.current = null;
      setDraftStroke(null);
      setSaveState("conflict");
      setNotice("对方刚刚改过这里，正在同步最新贴画…");
      try {
        const applied = await loadItems(undefined, true);
        setNotice(applied
          ? "对方刚刚改过这里，已同步最新贴画；冲突中的本地操作已取消。"
          : "检测到同时编辑，但同步尚未完成，请稍后再试。");
      } catch {
        setSaveState("error");
        setNotice("贴画发生冲突，请刷新页面后再试。");
      } finally {
        conflictSyncingRef.current = false;
        if (mountedRef.current) setConflictSyncing(false);
      }
      return;
    }
    setSaveState("error");
    setNotice(caught instanceof Error ? caught.message : "贴画保存失败，请稍后再试。");
  }, [loadItems, setItemsImmediately]);

  const enqueueWrite = useCallback((work: () => Promise<void>) => {
    if (isDemo) {
      setSaveState("saved");
      setNotice("演示预览只保留在当前页面，刷新后会重置。");
      return;
    }
    pendingWritesRef.current += 1;
    localChangeVersionRef.current += 1;
    const writeEpoch = writeEpochRef.current;
    setSaveState("saving");
    setNotice("");
    const guardedWork = async () => {
      if (writeEpoch !== writeEpochRef.current) return;
      await work();
    };
    writeQueueRef.current = writeQueueRef.current
      .then(guardedWork, guardedWork)
      .catch(handleWriteFailure)
      .finally(() => {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
        if (mountedRef.current && pendingWritesRef.current === 0) {
          setSaveState((current) => current === "saving" ? "saved" : current);
        }
      });
  }, [handleWriteFailure, isDemo]);

  const readItemResponse = useCallback(async (response: Response, fallback: string) => {
    if (response.status === 409) throw new Error("canvas-conflict");
    const result = await readApiJson<CanvasItemResponse>(response, fallback);
    if (!result.item) throw new Error(`${fallback}服务器没有返回贴画。`);
    return result.item;
  }, []);

  const mergeSavedItem = useCallback((target: EntryCanvasItem, saved: EntryCanvasItem) => {
    knownRevisionRef.current.set(saved.id, saved.revision);
    setItemsImmediately((current) => {
      const local = current.find((item) => item.id === saved.id);
      if (!local) return current;
      const merged = mutableItemsEqual(local, target)
        ? saved
        : {
            ...local,
            author_id: saved.author_id,
            revision: saved.revision,
            created_at: saved.created_at,
            updated_at: saved.updated_at,
          };
      return current.map((item) => item.id === saved.id ? merged : item);
    });
  }, [setItemsImmediately]);

  const persistCreate = useCallback((target: EntryCanvasItem) => {
    enqueueWrite(async () => {
      const response = await fetch(`/api/entries/${entryId}/canvas-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody(target)),
      });
      const saved = await readItemResponse(response, "贴画新增失败。");
      mergeSavedItem(target, saved);
    });
  }, [enqueueWrite, entryId, mergeSavedItem, readItemResponse]);

  const persistPatch = useCallback((target: EntryCanvasItem) => {
    enqueueWrite(async () => {
      const local = itemsRef.current.find((item) => item.id === target.id);
      const revision = knownRevisionRef.current.get(target.id)
        ?? local?.revision
        ?? target.revision;
      const response = await fetch(
        `/api/entries/${entryId}/canvas-items/${target.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision, ...mutableItem(target) }),
        },
      );
      const saved = await readItemResponse(response, "贴画更新失败。");
      mergeSavedItem(target, saved);
    });
  }, [enqueueWrite, entryId, mergeSavedItem, readItemResponse]);

  const persistDelete = useCallback((target: EntryCanvasItem) => {
    enqueueWrite(async () => {
      const revision = knownRevisionRef.current.get(target.id) ?? target.revision;
      const response = await fetch(
        `/api/entries/${entryId}/canvas-items/${target.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision }),
        },
      );
      if (response.status === 409) throw new Error("canvas-conflict");
      await readApiJson<{ ok?: boolean }>(response, "贴画删除失败。");
      knownRevisionRef.current.delete(target.id);
    });
  }, [enqueueWrite, entryId]);

  const createSticker = useCallback((clientX: number, clientY: number) => {
    if (conflictSyncingRef.current) return;
    if (itemsRef.current.length >= 150) {
      setNotice("这页已经有 150 个装饰啦，先整理一下再继续吧。");
      setSaveState("error");
      return;
    }
    const surface = surfaceRef.current;
    if (!surface) return;
    const anchorKey = anchorAtClientPoint(clientX, clientY);
    const anchor = anchorForKey(anchorKey);
    const surfaceRect = surface.getBoundingClientRect();
    const localX = clientX - surfaceRect.left;
    const localY = clientY - surfaceRect.top;
    const widthPx = clamp(anchor.width * 0.16, 64, 112);
    const placement = rootPointToAnchorRatio(
      { x: localX - widthPx / 2, y: localY - widthPx / 2 },
      anchor,
    );
    const range = itemZRange(itemsRef.current);
    const timestamp = nowIso();
    const item: EntryCanvasItem = {
      id: createId(),
      entry_id: entryId,
      author_id: "",
      kind: "sticker",
      anchor_key: anchorKey,
      x_ratio: clamp(placement.x, -0.5, 1.5),
      y_ratio: clamp(placement.y, -0.5, 1.5),
      width_ratio: clamp(widthPx / anchor.width, 0.03, 1),
      rotation: 0,
      opacity: 1,
      z_index: clamp(range.maximum + 1, -10_000, 10_000),
      payload: { assetKey: selectedAssetKey },
      revision: 0,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const before = itemsRef.current;
    setItemsImmediately([...before, item]);
    setSelectedId(item.id);
    recordHistory(before);
    persistCreate(item);
  }, [
    anchorAtClientPoint,
    anchorForKey,
    entryId,
    persistCreate,
    recordHistory,
    selectedAssetKey,
    setItemsImmediately,
  ]);

  const deleteItem = useCallback((item: EntryCanvasItem) => {
    if (conflictSyncingRef.current) return;
    const before = itemsRef.current;
    setItemsImmediately(before.filter((candidate) => candidate.id !== item.id));
    setSelectedId((current) => current === item.id ? null : current);
    recordHistory(before);
    persistDelete(item);
  }, [persistDelete, recordHistory, setItemsImmediately]);

  const updateItem = useCallback((
    item: EntryCanvasItem,
    changes: Partial<EntryCanvasItem>,
  ) => {
    if (conflictSyncingRef.current) return;
    const before = itemsRef.current;
    const nextItem = { ...item, ...changes, updated_at: nowIso() };
    setItemsImmediately(before.map((candidate) => candidate.id === item.id ? nextItem : candidate));
    recordHistory(before);
    persistPatch(nextItem);
  }, [persistPatch, recordHistory, setItemsImmediately]);

  const beginItemGesture = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    item: EntryCanvasItem,
    kind: ItemGesture["kind"],
  ) => {
    if (
      conflictSyncingRef.current
      || !editing
      || tool !== "select"
      || item.kind !== "sticker"
    ) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(item.id);
    const gesture: ItemGesture = {
      kind,
      pointerId: event.pointerId,
      itemId: item.id,
      before: itemsRef.current,
      original: item,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    if (kind === "rotate") {
      const surface = surfaceRef.current;
      const anchor = anchorForKey(item.anchor_key);
      if (!surface) return;
      const surfaceRect = surface.getBoundingClientRect();
      const width = item.width_ratio * anchor.width;
      gesture.centerClientX = surfaceRect.left + anchor.left + item.x_ratio * anchor.width + width / 2;
      gesture.centerClientY = surfaceRect.top + anchor.top + item.y_ratio * anchor.height + width / 2;
      gesture.startAngle = Math.atan2(
        event.clientY - gesture.centerClientY,
        event.clientX - gesture.centerClientX,
      ) * (180 / Math.PI);
    }
    gestureRef.current = gesture;
  }, [anchorForKey, editing, tool]);

  const handleItemPointerDown = useCallback((
    event: ReactPointerEvent<HTMLElement | SVGPathElement>,
    item: EntryCanvasItem,
  ) => {
    if (!editing) return;
    if (tool === "eraser") {
      event.preventDefault();
      event.stopPropagation();
      deleteItem(item);
      return;
    }
    if (tool === "select") {
      event.stopPropagation();
      setSelectedId(item.id);
      if (item.kind === "sticker") {
        beginItemGesture(event as ReactPointerEvent<HTMLElement>, item, "move");
      }
    }
  }, [beginItemGesture, deleteItem, editing, tool]);

  const updateGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.kind === "place") {
      if (
        Math.hypot(
          event.clientX - gesture.startClientX,
          event.clientY - gesture.startClientY,
        ) > 8
      ) {
        gesture.moved = true;
      }
      return;
    }
    event.preventDefault();
    const anchor = anchorForKey(gesture.original.anchor_key);
    const deltaX = event.clientX - gesture.startClientX;
    const deltaY = event.clientY - gesture.startClientY;
    let changes: Partial<EntryCanvasItem> = {};
    if (gesture.kind === "move") {
      changes = keepStickerReachable(
        gesture.original,
        gesture.original.x_ratio + deltaX / anchor.width,
        gesture.original.y_ratio + deltaY / anchor.height,
      );
    } else if (gesture.kind === "resize") {
      const originalWidth = gesture.original.width_ratio * anchor.width;
      const nextWidth = clamp(originalWidth + (deltaX + deltaY) / 2, 32, anchor.width);
      changes = { width_ratio: clamp(nextWidth / anchor.width, 0.03, 1) };
    } else if (
      gesture.startAngle !== undefined
      && gesture.centerClientX !== undefined
      && gesture.centerClientY !== undefined
    ) {
      const angle = Math.atan2(
        event.clientY - gesture.centerClientY,
        event.clientX - gesture.centerClientX,
      ) * (180 / Math.PI);
      changes = {
        rotation: normalizeRotation(
          Math.round(gesture.original.rotation + angle - gesture.startAngle),
        ),
      };
    }
    setItemsImmediately((current) => current.map((item) => (
      item.id === gesture.itemId ? { ...item, ...changes, updated_at: nowIso() } : item
    )));
  }, [anchorForKey, keepStickerReachable, setItemsImmediately]);

  const finishGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (gesture.kind === "place") {
      if (!gesture.moved) createSticker(gesture.startClientX, gesture.startClientY);
      return;
    }
    const changed = itemsRef.current.find((item) => item.id === gesture.itemId);
    if (!changed || mutableItemsEqual(changed, gesture.original)) return;
    recordHistory(gesture.before);
    persistPatch(changed);
  }, [createSticker, persistPatch, recordHistory]);

  const appendDraftPoint = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const draft = draftRef.current;
    const surface = surfaceRef.current;
    if (!draft || !surface || draft.pointerId !== event.pointerId) return;
    const anchor = anchorForKey(draft.anchorKey);
    const surfaceRect = surface.getBoundingClientRect();
    const localX = event.clientX - surfaceRect.left;
    const localY = event.clientY - surfaceRect.top;
    const originX = anchor.left + draft.originXRatio * anchor.width;
    const originY = anchor.top + draft.originYRatio * anchor.height;
    const nextPoint: Point = {
      x: clamp(
        (localX - originX) / anchor.width,
        -CANVAS_STROKE_POINT_RATIO_LIMIT,
        CANVAS_STROKE_POINT_RATIO_LIMIT,
      ),
      y: clamp(
        (localY - originY) / anchor.width,
        -CANVAS_STROKE_POINT_RATIO_LIMIT,
        CANVAS_STROKE_POINT_RATIO_LIMIT,
      ),
      pressure: event.pressure > 0 ? event.pressure : undefined,
    };
    const previous = draft.points[draft.points.length - 1];
    if (previous) {
      const distance = Math.hypot(
        (nextPoint.x - previous.x) * anchor.width,
        (nextPoint.y - previous.y) * anchor.width,
      );
      if (distance < 2) return;
    }
    if (draft.points.length >= MAX_RAW_STROKE_POINTS) return;
    const next = { ...draft, points: [...draft.points, nextPoint] };
    draftRef.current = next;
    setDraftStroke(next);
  }, [anchorForKey]);

  const finishStroke = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const draft = draftRef.current;
    if (!draft || draft.pointerId !== event.pointerId) return;
    appendDraftPoint(event);
    const completed = draftRef.current;
    draftRef.current = null;
    setDraftStroke(null);
    if (!completed?.points.length) return;
    if (itemsRef.current.length >= 150) {
      setNotice("这页已经有 150 个装饰啦，先整理一下再继续吧。");
      setSaveState("error");
      return;
    }
    const anchor = anchorForKey(completed.anchorKey);
    const points = simplifyCanvasPoints(completed.points, {
      anchorWidth: anchor.width,
      anchorHeight: anchor.width,
    });
    const range = itemZRange(itemsRef.current);
    const timestamp = nowIso();
    const item: EntryCanvasItem = {
      id: createId(),
      entry_id: entryId,
      author_id: "",
      kind: "stroke",
      anchor_key: completed.anchorKey,
      x_ratio: completed.originXRatio,
      y_ratio: completed.originYRatio,
      width_ratio: 1,
      rotation: 0,
      opacity: 1,
      z_index: clamp(range.maximum + 1, -10_000, 10_000),
      payload: {
        colorKey,
        width: brushWidth,
        points,
      },
      revision: 0,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const before = itemsRef.current;
    setItemsImmediately([...before, item]);
    setSelectedId(item.id);
    recordHistory(before);
    persistCreate(item);
  }, [
    appendDraftPoint,
    anchorForKey,
    brushWidth,
    colorKey,
    entryId,
    persistCreate,
    recordHistory,
    setItemsImmediately,
  ]);

  const handleOverlayPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      conflictSyncingRef.current
      || !editing
      || !decorationsVisible
      || event.button !== 0
    ) return;
    if (tool === "select") {
      setSelectedId(null);
      return;
    }
    if (tool === "sticker") {
      if (event.pointerType === "touch") {
        gestureRef.current = {
          kind: "place",
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      } else {
        event.preventDefault();
        createSticker(event.clientX, event.clientY);
      }
      return;
    }
    if (tool === "brush") {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const anchorKey = anchorAtClientPoint(event.clientX, event.clientY);
      const anchor = anchorForKey(anchorKey);
      const surface = surfaceRef.current;
      if (!surface) return;
      const surfaceRect = surface.getBoundingClientRect();
      const origin = rootPointToAnchorRatio(
        {
          x: event.clientX - surfaceRect.left,
          y: event.clientY - surfaceRect.top,
        },
        anchor,
      );
      const next: DraftStroke = {
        anchorKey,
        pointerId: event.pointerId,
        originXRatio: clamp(origin.x, -0.5, 1.5),
        originYRatio: clamp(origin.y, -0.5, 1.5),
        points: [],
      };
      draftRef.current = next;
      setDraftStroke(next);
      appendDraftPoint(event);
    }
  }, [
    anchorAtClientPoint,
    anchorForKey,
    appendDraftPoint,
    createSticker,
    decorationsVisible,
    editing,
    tool,
  ]);

  const handleOverlayPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (draftRef.current) {
      event.preventDefault();
      appendDraftPoint(event);
    } else {
      updateGesture(event);
    }
  }, [appendDraftPoint, updateGesture]);

  const handleOverlayPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (draftRef.current) finishStroke(event);
    else finishGesture(event);
  }, [finishGesture, finishStroke]);

  const reconcileSnapshot = useCallback((
    targetSnapshot: EntryCanvasItem[],
    currentSnapshot: EntryCanvasItem[],
  ) => {
    const currentById = new Map(currentSnapshot.map((item) => [item.id, item]));
    const targetById = new Map(targetSnapshot.map((item) => [item.id, item]));
    for (const current of currentSnapshot) {
      if (!targetById.has(current.id)) persistDelete(current);
    }
    for (const target of targetSnapshot) {
      const current = currentById.get(target.id);
      if (!current) persistCreate(target);
      else if (!mutableItemsEqual(current, target)) persistPatch(target);
    }
  }, [persistCreate, persistDelete, persistPatch]);

  const applyHistorySnapshot = useCallback((
    target: EntryCanvasItem[],
    current: EntryCanvasItem[],
  ) => {
    const currentById = new Map(current.map((item) => [item.id, item]));
    const withCurrentRevisions = target.map((item) => {
      const currentItem = currentById.get(item.id);
      return {
        ...item,
        revision: knownRevisionRef.current.get(item.id)
          ?? currentItem?.revision
          ?? item.revision,
      };
    });
    setItemsImmediately(withCurrentRevisions);
    setSelectedId((selected) => withCurrentRevisions.some((item) => item.id === selected)
      ? selected
      : null);
    reconcileSnapshot(withCurrentRevisions, current);
  }, [reconcileSnapshot, setItemsImmediately]);

  const undo = useCallback(() => {
    if (conflictSyncingRef.current) return;
    const target = undoRef.current.pop();
    if (!target) return;
    const current = itemsRef.current;
    redoRef.current.push(current);
    applyHistorySnapshot(target, current);
    setHistoryVersion((version) => version + 1);
  }, [applyHistorySnapshot]);

  const redo = useCallback(() => {
    if (conflictSyncingRef.current) return;
    const target = redoRef.current.pop();
    if (!target) return;
    const current = itemsRef.current;
    undoRef.current.push(current);
    applyHistorySnapshot(target, current);
    setHistoryVersion((version) => version + 1);
  }, [applyHistorySnapshot]);

  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (keyboardTargetIsEditable(event.target)) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Escape") {
        if (selectedId) setSelectedId(null);
        else setEditing(false);
        return;
      }
      if (!selectedItem) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteItem(selectedItem);
        return;
      }
      if (
        selectedItem.kind === "sticker"
        && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        event.preventDefault();
        const anchor = anchorForKey(selectedItem.anchor_key);
        const distance = event.shiftKey ? 10 : 2;
        const horizontal = event.key === "ArrowLeft" ? -distance
          : event.key === "ArrowRight" ? distance
            : 0;
        const vertical = event.key === "ArrowUp" ? -distance
          : event.key === "ArrowDown" ? distance
            : 0;
        updateItem(
          selectedItem,
          keepStickerReachable(
            selectedItem,
            selectedItem.x_ratio + horizontal / anchor.width,
            selectedItem.y_ratio + vertical / anchor.height,
          ),
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    anchorForKey,
    deleteItem,
    editing,
    keepStickerReachable,
    redo,
    selectedId,
    selectedItem,
    undo,
    updateItem,
  ]);

  function enterEditing() {
    setEditing(true);
    setDecorationsVisible(true);
    setTool("select");
    setNotice(isDemo ? "演示预览只保留在当前页面，刷新后会重置。" : "");
  }

  function leaveEditing() {
    gestureRef.current = null;
    draftRef.current = null;
    setDraftStroke(null);
    setSelectedId(null);
    setEditing(false);
  }

  function resetDemo() {
    const before = itemsRef.current;
    setItemsImmediately(initialItems);
    setSelectedId(null);
    recordHistory(before);
    setNotice("已重置本次演示预览。");
  }

  function selectTool(next: Tool) {
    gestureRef.current = null;
    draftRef.current = null;
    setDraftStroke(null);
    setTool(next);
    if (next !== "select") setSelectedId(null);
  }

  function layerSelected(direction: "front" | "back") {
    if (!selectedItem) return;
    const range = itemZRange(itemsRef.current);
    updateItem(selectedItem, {
      z_index: direction === "front"
        ? clamp(range.maximum + 1, -10_000, 10_000)
        : clamp(range.minimum - 1, -10_000, 10_000),
    });
  }

  function finishOpacityChange() {
    const before = opacityBeforeRef.current;
    opacityBeforeRef.current = null;
    if (!before || !selectedItem) return;
    const current = itemsRef.current.find((item) => item.id === selectedItem.id);
    const original = before.find((item) => item.id === selectedItem.id);
    if (!current || !original || mutableItemsEqual(current, original)) return;
    recordHistory(before);
    persistPatch(current);
  }

  const canvasSize = anchors[ROOT_ANCHOR] ?? {
    key: ROOT_ANCHOR,
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  };

  return (
    <div className={styles.shell} data-canvas-editing={editing ? "true" : "false"}>
      <button
        type="button"
        className={styles.launcher}
        onClick={editing ? leaveEditing : enterEditing}
        aria-pressed={editing}
      >
        {editing ? <X size={17} /> : <Palette size={17} />}
        {editing ? "完成装饰" : "装饰这页"}
      </button>

      <div ref={surfaceRef} className={styles.surface}>
        <div ref={contentRef} className={styles.content}>
          {children}
        </div>

        <div
          className={`${styles.overlay} ${editing ? styles.overlayEditing : ""} ${
            decorationsVisible ? "" : styles.overlayHidden
          } ${conflictSyncing ? styles.overlaySyncing : ""}`}
          data-tool={tool}
          aria-label={editing ? "帖子装饰画板" : undefined}
          aria-hidden={!editing || !decorationsVisible || tool !== "select"}
          onPointerDown={handleOverlayPointerDown}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerUp}
          onPointerCancel={(event) => {
            if (draftRef.current) finishStroke(event);
            else {
              const gesture = gestureRef.current;
              gestureRef.current = null;
              if (gesture && gesture.kind !== "place") {
                setItemsImmediately(gesture.before);
              }
            }
          }}
        >
          {items.map((item) => {
            const anchor = anchorForKey(item.anchor_key);
            if (item.kind === "stroke") {
              return (
                <CanvasStrokeItem
                  key={item.id}
                  item={item}
                  anchor={anchor}
                  canvasSize={canvasSize}
                  editing={editing}
                  decorationsVisible={decorationsVisible}
                  tool={tool}
                  selected={selectedId === item.id}
                  onPointerDown={handleItemPointerDown}
                  onSelect={setSelectedId}
                />
              );
            }

            const definition = getCanvasStickerDefinition(stickerPayload(item).assetKey);
            if (!definition) return null;
            const width = Math.max(24, item.width_ratio * anchor.width);
            const left = anchor.left + item.x_ratio * anchor.width;
            const top = anchor.top + item.y_ratio * anchor.height;
            const isSelected = editing
              && decorationsVisible
              && selectedId === item.id
              && tool === "select";
            return (
              <div
                key={item.id}
                className={`${styles.stickerItem} ${isSelected ? styles.selectedSticker : ""}`}
                style={{
                  left,
                  top,
                  width,
                  height: width,
                  opacity: item.opacity,
                  zIndex: item.z_index,
                  transform: `rotate(${item.rotation}deg)`,
                }}
              >
                <button
                  type="button"
                  className={styles.stickerHitTarget}
                  onPointerDown={(event) => handleItemPointerDown(event, item)}
                  onFocus={() => {
                    if (editing && decorationsVisible && tool === "select") {
                      setSelectedId(item.id);
                    }
                  }}
                  aria-label={`${definition.label}贴纸`}
                  tabIndex={editing && decorationsVisible && tool === "select" ? 0 : -1}
                >
                  <span className={styles.stickerSprite} style={stickerStyle(definition)} />
                </button>
                {isSelected && (
                  <>
                    <button
                      type="button"
                      className={`${styles.transformHandle} ${styles.rotateHandle}`}
                      onPointerDown={(event) => beginItemGesture(event, item, "rotate")}
                      aria-label="旋转贴纸"
                      title="拖动旋转"
                    >
                      <RotateCw size={13} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.transformHandle} ${styles.resizeHandle}`}
                      onPointerDown={(event) => beginItemGesture(event, item, "resize")}
                      aria-label="缩放贴纸"
                      title="拖动缩放"
                    />
                  </>
                )}
              </div>
            );
          })}

          {draftStroke && (() => {
            const anchor = anchorForKey(draftStroke.anchorKey);
            const color = COLOR_BY_KEY.get(colorKey) ?? COLOR_BY_KEY.get("coral")!;
            return (
              <svg
                className={styles.draftLayer}
                viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d={pathForPoints(
                    draftStroke.points,
                    anchor,
                    draftStroke.originXRatio,
                    draftStroke.originYRatio,
                  )}
                  fill="none"
                  stroke={color}
                  strokeWidth={brushWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          })()}
        </div>
      </div>

      {editing && (
        <aside
          className={`${styles.toolbar} ${conflictSyncing ? styles.toolbarSyncing : ""}`}
          aria-label="装饰工具栏"
          aria-busy={conflictSyncing}
        >
          <div className={styles.toolbarHeader}>
            <div>
              <b>一起装饰这页</b>
              <span>
                {isDemo
                  ? "演示模式 · 不会保存"
                  : saveState === "saving"
                    ? "正在保存…"
                    : saveState === "error"
                      ? "保存遇到问题"
                      : saveState === "conflict"
                        ? "已同步新版本"
                        : saveState === "saved"
                          ? "已保存"
                          : `${items.length} 个装饰`}
              </span>
            </div>
            <button type="button" onClick={leaveEditing} aria-label="完成装饰">
              <X size={17} />
            </button>
          </div>

          {notice && (
            <p
              className={`${styles.notice} ${saveState === "error" ? styles.noticeError : ""}`}
              role="status"
            >
              {notice}
            </p>
          )}

          <div className={styles.toolRow} role="toolbar" aria-label="画板工具">
            <ToolButton
              active={tool === "select"}
              label="选择"
              icon={<MousePointer2 size={17} />}
              onClick={() => selectTool("select")}
            />
            <ToolButton
              active={tool === "sticker"}
              label="贴纸"
              icon={<Palette size={17} />}
              onClick={() => selectTool("sticker")}
            />
            <ToolButton
              active={tool === "brush"}
              label="画笔"
              icon={<Brush size={17} />}
              onClick={() => selectTool("brush")}
            />
            <ToolButton
              active={tool === "eraser"}
              label="整笔擦除"
              icon={<Eraser size={17} />}
              onClick={() => selectTool("eraser")}
            />
          </div>

          <div className={styles.historyRow} key={historyVersion}>
            <button
              type="button"
              onClick={undo}
              disabled={!undoRef.current.length}
              title="撤销（⌘Z）"
            >
              <Undo2 size={16} /> 撤销
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!redoRef.current.length}
              title="重做（⇧⌘Z）"
            >
              <Redo2 size={16} /> 重做
            </button>
            <button
              type="button"
              onClick={() => {
                setDecorationsVisible((visible) => {
                  if (visible) setSelectedId(null);
                  return !visible;
                });
              }}
              title={decorationsVisible ? "暂时隐藏贴画" : "显示贴画"}
            >
              {decorationsVisible ? <Eye size={16} /> : <EyeOff size={16} />}
              {decorationsVisible ? "隐藏" : "显示"}
            </button>
          </div>

          {tool === "sticker" && (
            <section className={styles.paletteSection} aria-label="贴纸选择">
              <div className={styles.sectionLabel}>点一个图案，再点到页面上</div>
              <div className={styles.stickerGrid}>
                {CANVAS_STICKERS.map((sticker) => (
                  <button
                    key={sticker.assetKey}
                    type="button"
                    className={selectedAssetKey === sticker.assetKey ? styles.activeStickerChoice : ""}
                    onClick={() => setSelectedAssetKey(sticker.assetKey)}
                    aria-label={sticker.label}
                    aria-pressed={selectedAssetKey === sticker.assetKey}
                    title={sticker.label}
                  >
                    <span className={styles.stickerSprite} style={stickerStyle(sticker)} />
                  </button>
                ))}
              </div>
            </section>
          )}

          {tool === "brush" && (
            <section className={styles.paletteSection} aria-label="画笔设置">
              <div className={styles.sectionLabel}>画笔颜色</div>
              <div className={styles.colorRow}>
                {STROKE_COLORS.map((color) => (
                  <button
                    key={color.key}
                    type="button"
                    className={colorKey === color.key ? styles.activeColor : ""}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setColorKey(color.key)}
                    aria-label={color.label}
                    aria-pressed={colorKey === color.key}
                    title={color.label}
                  />
                ))}
              </div>
              <label className={styles.widthControl}>
                <span>粗细</span>
                <input
                  type="range"
                  min="3"
                  max="10"
                  step="1"
                  value={brushWidth}
                  onChange={(event) => setBrushWidth(Number(event.target.value))}
                />
                <output>{brushWidth}px</output>
              </label>
            </section>
          )}

          {tool === "eraser" && (
            <p className={styles.helperText}>点一下贴纸或线条，会整项擦除。可以随时撤销。</p>
          )}

          {tool === "select" && selectedItem && (
            <section className={styles.selectionPanel} aria-label="已选装饰操作">
              <div className={styles.sectionLabel}>
                已选择{selectedItem.kind === "sticker" ? "贴纸" : "一笔画"}
              </div>
              <div className={styles.selectionButtons}>
                <button type="button" onClick={() => layerSelected("front")}>
                  <ArrowUp size={15} /> 移到最上
                </button>
                <button type="button" onClick={() => layerSelected("back")}>
                  <ArrowDown size={15} /> 移到最下
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => deleteItem(selectedItem)}
                >
                  <Trash2 size={15} /> 删除
                </button>
              </div>
              <label className={styles.widthControl}>
                <span>透明度</span>
                <input
                  type="range"
                  min="0.15"
                  max="1"
                  step="0.05"
                  value={selectedItem.opacity}
                  onPointerDown={() => {
                    opacityBeforeRef.current = itemsRef.current;
                  }}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!opacityBeforeRef.current) {
                      opacityBeforeRef.current = itemsRef.current;
                    }
                    setItemsImmediately((current) => current.map((item) => (
                      item.id === selectedItem.id ? { ...item, opacity: value } : item
                    )));
                  }}
                  onPointerUp={finishOpacityChange}
                  onBlur={finishOpacityChange}
                />
                <output>{Math.round(selectedItem.opacity * 100)}%</output>
              </label>
            </section>
          )}

          {tool === "select" && !selectedItem && (
            <p className={styles.helperText}>
              点选贴纸后可拖动，角上的圆点负责缩放，上方按钮负责旋转。
            </p>
          )}

          {isDemo && items.length > 0 && (
            <button type="button" className={styles.resetDemo} onClick={resetDemo}>
              <Trash2 size={14} /> 清空本次预览
            </button>
          )}
        </aside>
      )}
    </div>
  );
}

function ToolButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? styles.activeTool : ""}
      onClick={onClick}
      aria-pressed={active}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
