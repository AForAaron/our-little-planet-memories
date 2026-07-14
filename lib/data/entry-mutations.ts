import "server-only";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import { getDatabase } from "@/lib/db/client";
import { entries, media, places } from "@/lib/db/schema";
import { createActivityEvent } from "@/lib/data/activity-stream";
import { createPartnerNotification } from "@/lib/data/notifications";
import {
  ENTRY_CATEGORIES,
  type EntryCategory,
  type MediaType,
} from "@/lib/database.types";
import { validateMediaUpload } from "@/lib/media/policy";
import { deletePrivateObject, inspectPrivateObject } from "@/lib/r2/client";

type UploadedMedia = {
  r2Key: string;
  thumbnailR2Key?: string;
  mime: string;
  type: MediaType;
  size: number;
  originalName: string;
};

function assertWritable() {
  if (!isLiveMode()) {
    throw new Error("演示模式不会写入数据。完成 Neon/R2 配置后再切换到 live。");
  }
}

function readEntryFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const happenedAt = String(formData.get("happened_at") ?? "");
  const mood = String(formData.get("mood") ?? "").trim();
  const categoryValue = String(formData.get("category") ?? "moment");
  const category = ENTRY_CATEGORIES.includes(categoryValue as EntryCategory)
    ? (categoryValue as EntryCategory)
    : "moment";
  const ratingValue = Number(formData.get("rating") ?? 0);
  const rating =
    Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5
      ? ratingValue
      : null;

  if (!title || !happenedAt) throw new Error("标题和发生时间不能为空。");
  const parsedDate = new Date(happenedAt);
  if (Number.isNaN(parsedDate.getTime())) throw new Error("发生时间格式不正确。");

  return {
    title,
    body: body || null,
    happenedAt: parsedDate,
    mood: mood || null,
    category,
    rating,
    updatedAt: new Date(),
  };
}

function readPlaceFields(formData: FormData, category: EntryCategory) {
  const rawName = String(formData.get("place_name") ?? "").trim();
  const rawLatitude = String(formData.get("latitude") ?? "").trim();
  const rawLongitude = String(formData.get("longitude") ?? "").trim();
  const hasName = Boolean(rawName);
  const hasAnyCoordinate = Boolean(rawLatitude || rawLongitude);
  if (!hasName && !hasAnyCoordinate) return null;
  if (!rawLatitude || !rawLongitude) {
    throw new Error("要显示在地图上，请同时填写纬度和经度，或使用当前位置/地图选点。");
  }
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("地点坐标格式不正确。");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("地点坐标超出有效范围。");
  }
  const name = rawName || "地图选点";
  const privacy = String(formData.get("privacy_level") ?? "approximate");
  const privacyLevel = ["exact", "approximate", "private"].includes(privacy)
    ? privacy
    : "approximate";
  const decimals = privacyLevel === "exact" ? 6 : privacyLevel === "private" ? 2 : 3;
  return {
    name,
    category: category === "food" ? "restaurant" : "attraction",
    lat: Number(latitude.toFixed(decimals)),
    lng: Number(longitude.toFixed(decimals)),
    privacyLevel,
    precisionM: privacyLevel === "exact" ? 5 : privacyLevel === "private" ? 1000 : 100,
  };
}

function readUploadedMedia(formData: FormData, userId: string) {
  const raw = String(formData.get("uploaded_media") ?? "[]");
  const uploaded = JSON.parse(raw) as UploadedMedia[];
  if (!Array.isArray(uploaded) || uploaded.length > 20) {
    throw new Error("一次最多添加 20 个媒体文件。");
  }
  for (const item of uploaded) {
    const type = validateMediaUpload(item.mime, item.size);
    if (type !== item.type || !item.r2Key.startsWith(`uploads/${userId}/`)) {
      throw new Error("媒体上传凭据无效。");
    }
    if (
      item.thumbnailR2Key != null &&
      ((type !== "image" && type !== "video") ||
        typeof item.thumbnailR2Key !== "string" ||
        !item.thumbnailR2Key.startsWith(`uploads/${userId}/thumbnails/`))
    ) {
      throw new Error("缩略图上传凭据无效。");
    }
  }
  return uploaded;
}

async function verifyUploadedMedia(uploaded: UploadedMedia[]) {
  await Promise.all(
    uploaded.map(async (item) => {
      const [object, thumbnail] = await Promise.all([
        inspectPrivateObject(item.r2Key),
        item.thumbnailR2Key ? inspectPrivateObject(item.thumbnailR2Key) : Promise.resolve(null),
      ]);
      if (
        object.contentLength !== item.size ||
        object.contentType !== item.mime
      ) {
        throw new Error("媒体对象与上传凭据不一致，请重新选择文件上传。");
      }
      if (
        thumbnail &&
        (thumbnail.contentType !== "image/webp" ||
          !thumbnail.contentLength ||
          thumbnail.contentLength > 2 * 1024 * 1024)
      ) {
        throw new Error("缩略图对象与上传凭据不一致，请重新选择文件上传。");
      }
    }),
  );
}

async function attachMedia(entryId: string, uploaded: UploadedMedia[]) {
  if (!uploaded.length) return [];
  return getDatabase().insert(media).values(
    uploaded.map((item, index) => ({
      entryId,
      r2Key: item.r2Key,
      thumbnailR2Key: item.thumbnailR2Key ?? null,
      mime: item.mime,
      type: item.type,
      caption: item.originalName,
      sortOrder: index,
    })),
  ).returning({ id: media.id });
}

async function deletePlaceIfUnused(placeId: string | null) {
  if (!placeId) return;
  const db = getDatabase();
  const [reference] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(eq(entries.placeId, placeId))
    .limit(1);
  if (!reference) {
    await db.delete(places).where(eq(places.id, placeId));
  }
}

function refreshMemoryPages() {
  revalidatePath("/home");
  revalidatePath("/time/timeline");
  revalidatePath("/time");
  revalidatePath("/daily");
  revalidatePath("/places");
  revalidatePath("/footprints");
  revalidatePath("/notifications");
}

export async function createEntryFromForm(formData: FormData) {
  assertWritable();
  const user = await requireCoupleUser();
  const uploaded = readUploadedMedia(formData, user.id);
  const db = getDatabase();
  let entryId: string | null = null;
  let createdPlaceId: string | null = null;
  try {
    await verifyUploadedMedia(uploaded);
    const fields = readEntryFields(formData);
    const placeFields = readPlaceFields(formData, fields.category);
    const [place] = placeFields
      ? await db.insert(places).values(placeFields).returning({ id: places.id })
      : [];
    createdPlaceId = place?.id ?? null;
    const [entry] = await db
      .insert(entries)
      .values({
        ...fields,
        authorId: user.id,
        updatedBy: user.id,
        placeId: place?.id ?? null,
        happenedPrecision: "exact",
      })
      .returning({ id: entries.id });
    entryId = entry.id;
    await attachMedia(entry.id, uploaded);
    const actorName = user.name?.trim() || user.email.split("@")[0];
    await createActivityEvent({
      actorId: user.id,
      kind: "entry_created",
      sourceType: "entry",
      sourceId: entry.id,
      entryId: entry.id,
      pagePath: `/memories/${entry.id}`,
      pageTitle: fields.title,
      body: fields.body,
      createdAt: fields.updatedAt,
    }).catch(() => undefined);
    await createPartnerNotification({
      actorId: user.id,
      type: "entry_created",
      entryId: entry.id,
      title: `${actorName} 发布了新回忆《${fields.title}》`,
      body: fields.body,
      href: `/memories/${entry.id}`,
    }).catch(() => undefined);
  } catch (error) {
    if (entryId) await db.delete(entries).where(eq(entries.id, entryId));
    if (createdPlaceId) {
      await db.delete(places).where(eq(places.id, createdPlaceId));
    }
    await Promise.allSettled(
      uploaded.flatMap((item) => [item.r2Key, ...(item.thumbnailR2Key ? [item.thumbnailR2Key] : [])]).map((key) => deletePrivateObject(key)),
    );
    throw error;
  }
  refreshMemoryPages();
  return entryId;
}

export async function updateEntryFromForm(formData: FormData) {
  assertWritable();
  const user = await requireCoupleUser();
  const uploaded = readUploadedMedia(formData, user.id);
  const db = getDatabase();
  const id = String(formData.get("id") ?? "");
  let createdPlaceId: string | null = null;
  let attachedMediaIds: string[] = [];
  try {
    if (!id) throw new Error("缺少要编辑的回忆 ID。");
    await verifyUploadedMedia(uploaded);
    const [existing] = await db
      .select({ id: entries.id, placeId: entries.placeId })
      .from(entries)
      .where(eq(entries.id, id))
      .limit(1);
    if (!existing) throw new Error("没有找到这条回忆。");

    const fields = readEntryFields(formData);
    const placeFields = readPlaceFields(formData, fields.category);
    const [place] = placeFields
      ? await db.insert(places).values(placeFields).returning({ id: places.id })
      : [];
    createdPlaceId = place?.id ?? null;

    attachedMediaIds = (await attachMedia(id, uploaded)).map(({ id: mediaId }) => mediaId);
    const [updated] = await db
      .update(entries)
      .set({ ...fields, updatedBy: user.id, placeId: place?.id ?? null })
      .where(eq(entries.id, id))
      .returning({ id: entries.id });
    if (!updated) throw new Error("没有找到这条回忆。");
    const actorName = user.name?.trim() || user.email.split("@")[0];
    await createActivityEvent({
      actorId: user.id,
      kind: "entry_updated",
      sourceType: "entry_update",
      sourceId: `${id}:${fields.updatedAt.toISOString()}`,
      entryId: id,
      pagePath: `/memories/${id}`,
      pageTitle: fields.title,
      body: fields.body,
      createdAt: fields.updatedAt,
    }).catch(() => undefined);
    await createPartnerNotification({
      actorId: user.id,
      type: "entry_updated",
      entryId: id,
      title: `${actorName} 修改了《${fields.title}》`,
      body: fields.body,
      href: `/memories/${id}`,
    }).catch(() => undefined);

    if (existing.placeId !== (place?.id ?? null)) {
      await deletePlaceIfUnused(existing.placeId).catch(() => undefined);
    }
  } catch (error) {
    if (attachedMediaIds.length) {
      await db.delete(media).where(inArray(media.id, attachedMediaIds));
    }
    if (createdPlaceId) {
      await db.delete(places).where(eq(places.id, createdPlaceId));
    }
    await Promise.allSettled(
      uploaded.flatMap((item) => [item.r2Key, ...(item.thumbnailR2Key ? [item.thumbnailR2Key] : [])]).map((key) => deletePrivateObject(key)),
    );
    throw error;
  }
  refreshMemoryPages();
  return id;
}

export async function deleteEntryById(id: string) {
  assertWritable();
  await requireCoupleUser();
  const db = getDatabase();
  const linkedMedia = await db
    .select({ key: media.r2Key, thumbnailKey: media.thumbnailR2Key })
    .from(media)
    .where(eq(media.entryId, id));
  const [deleted] = await db
    .delete(entries)
    .where(eq(entries.id, id))
    .returning({ id: entries.id });
  if (!deleted) throw new Error("没有找到这条回忆。");
  await Promise.allSettled(
    linkedMedia
      .flatMap(({ key, thumbnailKey }) => [key, ...(thumbnailKey ? [thumbnailKey] : [])])
      .map((key) => deletePrivateObject(key)),
  );
  refreshMemoryPages();
}
