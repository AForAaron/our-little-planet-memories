import "server-only";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";
import { getDatabase } from "@/lib/db/client";
import { entries, media, places } from "@/lib/db/schema";
import {
  ENTRY_CATEGORIES,
  type EntryCategory,
  type MediaType,
} from "@/lib/database.types";
import { validateMediaUpload } from "@/lib/media/policy";
import { deletePrivateObject } from "@/lib/r2/client";

type UploadedMedia = {
  r2Key: string;
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
  }
  return uploaded;
}

async function attachMedia(entryId: string, uploaded: UploadedMedia[]) {
  if (!uploaded.length) return;
  await getDatabase().insert(media).values(
    uploaded.map((item, index) => ({
      entryId,
      r2Key: item.r2Key,
      mime: item.mime,
      type: item.type,
      caption: item.originalName,
      sortOrder: index,
    })),
  );
}

function refreshMemoryPages() {
  revalidatePath("/home");
  revalidatePath("/time/timeline");
  revalidatePath("/time");
  revalidatePath("/daily");
  revalidatePath("/places");
}

export async function createEntryFromForm(formData: FormData) {
  assertWritable();
  const user = await requireCoupleUser();
  const uploaded = readUploadedMedia(formData, user.id);
  const db = getDatabase();
  let entryId: string | null = null;
  let createdPlaceId: string | null = null;
  try {
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
    refreshMemoryPages();
    return entry.id;
  } catch (error) {
    if (entryId) await db.delete(entries).where(eq(entries.id, entryId));
    if (createdPlaceId) {
      await db.delete(places).where(eq(places.id, createdPlaceId));
    }
    await Promise.allSettled(
      uploaded.map((item) => deletePrivateObject(item.r2Key)),
    );
    throw error;
  }
}

export async function updateEntryFromForm(formData: FormData) {
  assertWritable();
  const user = await requireCoupleUser();
  const uploaded = readUploadedMedia(formData, user.id);
  const db = getDatabase();
  const id = String(formData.get("id") ?? "");
  const fields = readEntryFields(formData);
  const placeFields = readPlaceFields(formData, fields.category);
  const [place] = placeFields
    ? await db.insert(places).values(placeFields).returning({ id: places.id })
    : [];
  const [updated] = await db
    .update(entries)
    .set({ ...fields, updatedBy: user.id, ...(place ? { placeId: place.id } : {}) })
    .where(eq(entries.id, id))
    .returning({ id: entries.id });
  if (!updated) throw new Error("没有找到这条回忆。");

  try {
    await attachMedia(id, uploaded);
    refreshMemoryPages();
    return id;
  } catch (error) {
    await Promise.allSettled(
      uploaded.map((item) => deletePrivateObject(item.r2Key)),
    );
    throw error;
  }
}

export async function deleteEntryById(id: string) {
  assertWritable();
  await requireCoupleUser();
  const db = getDatabase();
  const linkedMedia = await db
    .select({ key: media.r2Key })
    .from(media)
    .where(eq(media.entryId, id));
  const [deleted] = await db
    .delete(entries)
    .where(eq(entries.id, id))
    .returning({ id: entries.id });
  if (!deleted) throw new Error("没有找到这条回忆。");
  await Promise.allSettled(
    linkedMedia.map(({ key }) => deletePrivateObject(key)),
  );
  refreshMemoryPages();
}
