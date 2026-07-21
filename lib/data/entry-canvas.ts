import "server-only";

import { and, asc, count, eq } from "drizzle-orm";
import { getCoupleUser } from "@/lib/auth/server";
import {
  assertCanvasUuid,
  CANVAS_MAX_ITEMS,
  isCanvasRevisionConflict,
  validateCanvasItemCreate,
  validateCanvasItemPatch,
  validateCanvasRevision,
} from "@/lib/canvas/validation";
import { EntryCanvasError } from "@/lib/canvas/errors";
import { isLiveMode } from "@/lib/config/backend";
import type {
  CanvasItemKind,
  CanvasItemPayload,
  EntryCanvasItem,
} from "@/lib/database.types";
import { getDatabase } from "@/lib/db/client";
import { entries, entryCanvasItems } from "@/lib/db/schema";

type CanvasItemRow = typeof entryCanvasItems.$inferSelect;

function mapCanvasItem(row: CanvasItemRow): EntryCanvasItem {
  return {
    id: row.id,
    entry_id: row.entryId,
    author_id: row.authorId,
    kind: row.kind as CanvasItemKind,
    anchor_key: row.anchorKey,
    x_ratio: row.xRatio,
    y_ratio: row.yRatio,
    width_ratio: row.widthRatio,
    rotation: row.rotation,
    opacity: row.opacity,
    z_index: row.zIndex,
    payload: row.payload as CanvasItemPayload,
    revision: row.revision,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function requireCanvasUser() {
  const user = await getCoupleUser();
  if (!user) {
    throw new EntryCanvasError("请使用已验证的白名单邮箱重新登录。", 401);
  }
  return user;
}

async function assertEntryExists(entryId: string) {
  const normalizedId = assertCanvasUuid(entryId, "回忆 ID");
  const [entry] = await getDatabase()
    .select({ id: entries.id })
    .from(entries)
    .where(eq(entries.id, normalizedId))
    .limit(1);
  if (!entry) throw new EntryCanvasError("没有找到这条回忆。", 404);
  return normalizedId;
}

async function getLiveCanvasRow(entryId: string, itemId: string) {
  const [row] = await getDatabase()
    .select()
    .from(entryCanvasItems)
    .where(
      and(
        eq(entryCanvasItems.entryId, entryId),
        eq(entryCanvasItems.id, itemId),
      ),
    )
    .limit(1);
  return row ?? null;
}

function payloadsMatch(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isCanvasItemLimitError(error: unknown) {
  return Boolean(
    error
    && typeof error === "object"
    && "constraint" in error
    && error.constraint === "entry_canvas_items_limit_check",
  );
}

function rowMatchesCreate(
  row: CanvasItemRow,
  input: ReturnType<typeof validateCanvasItemCreate>,
  entryId: string,
  authorId: string,
) {
  return (
    row.entryId === entryId &&
    row.authorId === authorId &&
    row.kind === input.kind &&
    row.anchorKey === input.anchorKey &&
    row.xRatio === input.xRatio &&
    row.yRatio === input.yRatio &&
    row.widthRatio === input.widthRatio &&
    row.rotation === input.rotation &&
    row.opacity === input.opacity &&
    row.zIndex === input.zIndex &&
    payloadsMatch(row.payload, input.payload)
  );
}

function makeDemoItem(
  entryId: string,
  input: ReturnType<typeof validateCanvasItemCreate>,
): EntryCanvasItem {
  const now = new Date().toISOString();
  return {
    id: input.id,
    entry_id: entryId,
    author_id: "demo-self",
    kind: input.kind,
    anchor_key: input.anchorKey,
    x_ratio: input.xRatio,
    y_ratio: input.yRatio,
    width_ratio: input.widthRatio,
    rotation: input.rotation,
    opacity: input.opacity,
    z_index: input.zIndex,
    payload: input.payload,
    revision: 1,
    created_at: now,
    updated_at: now,
  };
}

export async function getEntryCanvasItems(
  entryId: string,
): Promise<EntryCanvasItem[]> {
  if (!isLiveMode()) return [];
  await requireCanvasUser();
  const normalizedEntryId = await assertEntryExists(entryId);
  const rows = await getDatabase()
    .select()
    .from(entryCanvasItems)
    .where(eq(entryCanvasItems.entryId, normalizedEntryId))
    .orderBy(
      asc(entryCanvasItems.zIndex),
      asc(entryCanvasItems.createdAt),
      asc(entryCanvasItems.id),
    );
  return rows.map(mapCanvasItem);
}

export async function createEntryCanvasItem(
  entryId: string,
  value: unknown,
): Promise<EntryCanvasItem> {
  if (!isLiveMode()) {
    return makeDemoItem(entryId, validateCanvasItemCreate(value));
  }

  const user = await requireCanvasUser();
  const input = validateCanvasItemCreate(value);
  const normalizedEntryId = await assertEntryExists(entryId);
  const db = getDatabase();
  const [existing] = await db
    .select()
    .from(entryCanvasItems)
    .where(eq(entryCanvasItems.id, input.id))
    .limit(1);
  if (existing) {
    if (rowMatchesCreate(existing, input, normalizedEntryId, user.id)) {
      return mapCanvasItem(existing);
    }
    throw new EntryCanvasError("这个画板元素 ID 已被使用，请刷新后重试。", 409);
  }

  const [summary] = await db
    .select({ value: count() })
    .from(entryCanvasItems)
    .where(eq(entryCanvasItems.entryId, normalizedEntryId));
  if ((summary?.value ?? 0) >= CANVAS_MAX_ITEMS) {
    throw new EntryCanvasError("这张画板已经有 150 个元素，请先删掉一些再继续。", 409);
  }

  const now = new Date();
  let created: CanvasItemRow | undefined;
  try {
    [created] = await db
      .insert(entryCanvasItems)
      .values({
        id: input.id,
        entryId: normalizedEntryId,
        authorId: user.id,
        kind: input.kind,
        anchorKey: input.anchorKey,
        xRatio: input.xRatio,
        yRatio: input.yRatio,
        widthRatio: input.widthRatio,
        rotation: input.rotation,
        opacity: input.opacity,
        zIndex: input.zIndex,
        payload: input.payload as unknown as Record<string, unknown>,
        revision: 1,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: entryCanvasItems.id })
      .returning();
  } catch (error) {
    if (isCanvasItemLimitError(error)) {
      const raced = await getLiveCanvasRow(normalizedEntryId, input.id);
      if (raced && rowMatchesCreate(raced, input, normalizedEntryId, user.id)) {
        return mapCanvasItem(raced);
      }
      throw new EntryCanvasError(
        "这张画板已经有 150 个元素，请先删掉一些再继续。",
        409,
      );
    }
    throw error;
  }
  if (created) return mapCanvasItem(created);

  const raced = await getLiveCanvasRow(normalizedEntryId, input.id);
  if (raced && rowMatchesCreate(raced, input, normalizedEntryId, user.id)) {
    return mapCanvasItem(raced);
  }
  throw new EntryCanvasError("这个画板元素刚刚被其他操作占用，请刷新后重试。", 409);
}

export async function updateEntryCanvasItem(
  entryId: string,
  itemId: string,
  value: unknown,
): Promise<EntryCanvasItem> {
  if (!isLiveMode()) {
    const normalizedItemId = assertCanvasUuid(itemId, "画板元素 ID");
    const valueRecord =
      typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)
        : {};
    const payloadRecord =
      typeof valueRecord.payload === "object" && valueRecord.payload !== null
        ? (valueRecord.payload as Record<string, unknown>)
        : null;
    const inferredKind: CanvasItemKind = payloadRecord && "colorKey" in payloadRecord
      ? "stroke"
      : "sticker";
    const patch = validateCanvasItemPatch(value, inferredKind);
    const fallbackPayload: CanvasItemPayload = inferredKind === "stroke"
      ? { colorKey: "ink", width: 3, points: [{ x: 0, y: 0 }] }
      : { assetKey: "donut-planet" };
    const now = new Date().toISOString();
    return {
      id: normalizedItemId,
      entry_id: entryId,
      author_id: "demo-self",
      kind: inferredKind,
      anchor_key: patch.anchorKey ?? "root",
      x_ratio: patch.xRatio ?? 0,
      y_ratio: patch.yRatio ?? 0,
      width_ratio: patch.widthRatio ?? 0.15,
      rotation: patch.rotation ?? 0,
      opacity: patch.opacity ?? 1,
      z_index: patch.zIndex ?? 0,
      payload: patch.payload ?? fallbackPayload,
      revision: patch.revision + 1,
      created_at: now,
      updated_at: now,
    };
  }

  await requireCanvasUser();
  const normalizedEntryId = await assertEntryExists(entryId);
  const normalizedItemId = assertCanvasUuid(itemId, "画板元素 ID");
  const existing = await getLiveCanvasRow(normalizedEntryId, normalizedItemId);
  if (!existing) throw new EntryCanvasError("没有找到这个画板元素。", 404);
  const patch = validateCanvasItemPatch(
    value,
    existing.kind as CanvasItemKind,
  );
  if (isCanvasRevisionConflict(existing.revision, patch.revision)) {
    throw new EntryCanvasError(
      "这个画板元素已被对方更新，请刷新后再试。",
      409,
      mapCanvasItem(existing),
    );
  }

  const changes: Partial<typeof entryCanvasItems.$inferInsert> = {
    revision: patch.revision + 1,
    updatedAt: new Date(),
  };
  if (patch.anchorKey !== undefined) changes.anchorKey = patch.anchorKey;
  if (patch.xRatio !== undefined) changes.xRatio = patch.xRatio;
  if (patch.yRatio !== undefined) changes.yRatio = patch.yRatio;
  if (patch.widthRatio !== undefined) changes.widthRatio = patch.widthRatio;
  if (patch.rotation !== undefined) changes.rotation = patch.rotation;
  if (patch.opacity !== undefined) changes.opacity = patch.opacity;
  if (patch.zIndex !== undefined) changes.zIndex = patch.zIndex;
  if (patch.payload !== undefined) {
    changes.payload = patch.payload as unknown as Record<string, unknown>;
  }

  const [updated] = await getDatabase()
    .update(entryCanvasItems)
    .set(changes)
    .where(
      and(
        eq(entryCanvasItems.entryId, normalizedEntryId),
        eq(entryCanvasItems.id, normalizedItemId),
        eq(entryCanvasItems.revision, patch.revision),
      ),
    )
    .returning();
  if (updated) return mapCanvasItem(updated);

  const latest = await getLiveCanvasRow(normalizedEntryId, normalizedItemId);
  if (!latest) throw new EntryCanvasError("没有找到这个画板元素。", 404);
  throw new EntryCanvasError(
    "这个画板元素已被对方更新，请刷新后再试。",
    409,
    mapCanvasItem(latest),
  );
}

export async function deleteEntryCanvasItem(
  entryId: string,
  itemId: string,
  value: unknown,
) {
  if (!isLiveMode()) {
    return {
      ok: true as const,
      id: assertCanvasUuid(itemId, "画板元素 ID"),
      revision: validateCanvasRevision(value),
    };
  }

  await requireCanvasUser();
  const revision = validateCanvasRevision(value);
  const normalizedEntryId = await assertEntryExists(entryId);
  const normalizedItemId = assertCanvasUuid(itemId, "画板元素 ID");
  const existing = await getLiveCanvasRow(normalizedEntryId, normalizedItemId);
  if (!existing) throw new EntryCanvasError("没有找到这个画板元素。", 404);
  if (isCanvasRevisionConflict(existing.revision, revision)) {
    throw new EntryCanvasError(
      "这个画板元素已被对方更新，请刷新后再试。",
      409,
      mapCanvasItem(existing),
    );
  }
  const [deleted] = await getDatabase()
    .delete(entryCanvasItems)
    .where(
      and(
        eq(entryCanvasItems.entryId, normalizedEntryId),
        eq(entryCanvasItems.id, normalizedItemId),
        eq(entryCanvasItems.revision, revision),
      ),
    )
    .returning({ id: entryCanvasItems.id });
  if (deleted) return { ok: true as const, id: deleted.id, revision };

  const latest = await getLiveCanvasRow(normalizedEntryId, normalizedItemId);
  if (!latest) {
    throw new EntryCanvasError(
      "这个画板元素已经被删除，请刷新后再试。",
      409,
    );
  }
  throw new EntryCanvasError(
    "这个画板元素已被对方更新，请刷新后再试。",
    409,
    mapCanvasItem(latest),
  );
}
