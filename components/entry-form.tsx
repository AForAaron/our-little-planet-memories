"use client";

import { Crosshair, ImagePlus, LoaderCircle, MapPinned, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocationPicker } from "@/components/location-picker";
import {
  ENTRY_CATEGORIES,
  type Entry,
  type EntryCategory,
  type MediaType,
} from "@/lib/database.types";

const CATEGORY_LABELS: Record<EntryCategory, string> = {
  moment: "日常回忆",
  diary: "共同日记",
  trip: "旅行",
  first: "第一次",
  milestone: "里程碑",
  anniversary: "纪念日",
  food: "探店",
  watch: "观影",
};

type UploadedMedia = {
  r2Key: string;
  mime: string;
  type: MediaType;
  size: number;
  originalName: string;
};

type EntryDraft = {
  category: EntryCategory;
  title: string;
  happened_at: string;
  mood: string;
  rating: string;
  body: string;
  place_name: string;
  latitude: string;
  longitude: string;
  privacy_level: "exact" | "approximate" | "private";
};

type GeocodeResult = {
  name: string;
  displayName: string;
  latitude: string;
  longitude: string;
  category?: string;
};

function localDateTime(iso?: string) {
  const date = iso ? new Date(iso) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function uploadFiles(files: File[]) {
  const uploaded: UploadedMedia[] = [];
  try {
    for (const file of files) {
      const response = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mime: file.type,
          size: file.size,
        }),
      });
      const signed = await readJsonResponse<{
        error?: string;
        uploadUrl: string;
        r2Key: string;
        mime: string;
        type: MediaType;
      }>(response, "无法创建上传地址。");
      if (!response.ok) throw new Error(signed.error || "无法创建上传地址。");
      const result = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error(`上传 ${file.name} 失败（${result.status}）。请检查 R2 CORS 和 bucket 权限。`);
      uploaded.push({
        r2Key: signed.r2Key,
        mime: signed.mime,
        type: signed.type,
        size: file.size,
        originalName: file.name,
      });
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) {
      await fetch("/api/uploads/presign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: uploaded.map((item) => item.r2Key) }),
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function readJsonResponse<T>(response: Response, fallback: string): Promise<T & { error?: string }> {
  const text = await response.text();
  if (!text) return {} as T & { error?: string };
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return {
      error: response.redirected
        ? "登录状态异常，请刷新页面或重新登录后再保存。"
        : `${fallback}服务器返回了 ${response.status}，但不是 JSON 响应。`,
    } as T & { error?: string };
  }
}

function initialDraft(entry: Entry | null | undefined, defaultCategory: EntryCategory): EntryDraft {
  return {
    category: entry?.category ?? defaultCategory,
    title: entry?.title ?? "",
    happened_at: localDateTime(entry?.happened_at),
    mood: entry?.mood ?? "",
    rating: entry?.rating ? String(entry.rating) : "",
    body: entry?.body ?? "",
    place_name: "",
    latitude: "",
    longitude: "",
    privacy_level: "approximate",
  };
}

function looksLikeNullIsland(latitude: string, longitude: string) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) < 1 && Math.abs(lng) < 1;
}

export function EntryForm({
  entry,
  onClose,
  defaultCategory = "moment",
}: {
  entry?: Entry | null;
  onClose: () => void;
  defaultCategory?: EntryCategory;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const [geocodePending, setGeocodePending] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const draftKey = useMemo(
    () => `little-planet-entry-draft:${entry?.id ?? "new"}:${defaultCategory}`,
    [defaultCategory, entry?.id],
  );
  const [draft, setDraft] = useState<EntryDraft>(() =>
    initialDraft(entry, defaultCategory),
  );

  useEffect(() => {
    setDraft(initialDraft(entry, defaultCategory));
  }, [defaultCategory, entry]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) {
        setDraft((current) => ({
          ...current,
          ...(JSON.parse(saved) as Partial<EntryDraft>),
        }));
      }
    } catch {
      // Local draft restore is best-effort.
    }
  }, [draftKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Local draft persistence is best-effort.
    }
  }, [draft, draftKey]);

  function updateDraft<K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function useCurrentLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("当前浏览器不支持定位。");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateDraft("latitude", position.coords.latitude.toFixed(6));
        updateDraft("longitude", position.coords.longitude.toFixed(6));
        if (!draft.place_name.trim()) updateDraft("place_name", "当前位置");
      },
      (locationIssue) => {
        const message =
          locationIssue.code === locationIssue.PERMISSION_DENIED
            ? "浏览器没有定位权限，请在地址栏允许位置权限后重试。"
            : "无法获取当前位置，请稍后重试或手动在地图上选择。";
        setLocationError(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  }

  async function searchPlaceByName() {
    const query = draft.place_name.trim();
    setLocationError("");
    setGeocodeResults([]);
    if (!query) {
      setLocationError("先输入地点名称，例如：伊宁 汉庭。");
      return;
    }
    setGeocodePending(true);
    try {
      const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`);
      const result = await readJsonResponse<{ results?: GeocodeResult[] }>(response, "地点搜索失败。");
      if (!response.ok) throw new Error(result.error || "地点搜索失败。");
      const results = result.results ?? [];
      if (!results.length) {
        setLocationError("没有找到匹配地点。可以换一个更完整的名称，例如加城市、区县或省份。");
        return;
      }
      setGeocodeResults(results);
    } catch (caught) {
      setLocationError(caught instanceof Error ? caught.message : "地点搜索失败，请稍后重试。");
    } finally {
      setGeocodePending(false);
    }
  }

  function chooseGeocodeResult(result: GeocodeResult) {
    updateDraft("place_name", result.name || result.displayName);
    updateDraft("latitude", result.latitude);
    updateDraft("longitude", result.longitude);
    setGeocodeResults([]);
    setMapOpen(true);
  }

  function clearCoordinates() {
    updateDraft("latitude", "");
    updateDraft("longitude", "");
    setLocationError("");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const formData = new FormData(event.currentTarget);
        const files = formData
          .getAll("media_files")
          .filter((item): item is File => item instanceof File && item.size > 0);
        formData.delete("media_files");
        const uploaded = await uploadFiles(files);
        formData.set("uploaded_media", JSON.stringify(uploaded));
        let response: Response;
        if (entry) {
          formData.set("id", entry.id);
          response = await fetch("/api/entries", {
            method: "PATCH",
            body: formData,
          });
        } else {
          response = await fetch("/api/entries", {
            method: "POST",
            body: formData,
          });
        }
        const result = await readJsonResponse<{ id?: string }>(response, "保存回忆失败。");
        if (!response.ok) throw new Error(result.error || "保存回忆失败。");
        window.localStorage.removeItem(draftKey);
        router.refresh();
        onClose();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "保存失败，请稍后重试。");
      }
    });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="entry-form-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal-card max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="eyebrow">Memory</span>
            <h2 id="entry-form-title" className="mt-2 font-heading text-2xl font-bold">
              {entry ? "编辑这段回忆" : "收藏一段新回忆"}
            </h2>
            {entry?.profiles?.display_name && (
              <p className="mt-2 text-sm text-muted">
                这段回忆由 {entry.profiles.display_name} 写下；保存后会记录当前账号为最后编辑者。
              </p>
            )}
          </div>
          <button className="button-secondary size-10 !p-0" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="mt-7 grid gap-5">
          <label className="label">
            类型
            <select
              className="field"
              name="category"
              value={draft.category}
              onChange={(event) => updateDraft("category", event.target.value as EntryCategory)}
            >
              {ENTRY_CATEGORIES.map((category) => (
                <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
              ))}
            </select>
          </label>
          <label className="label">
            标题
            <input
              className="field"
              name="title"
              value={draft.title}
              onChange={(event) => updateDraft("title", event.target.value)}
              maxLength={100}
              required
            />
          </label>
          <label className="label">
            发生时间
            <input
              className="field"
              name="happened_at"
              type="datetime-local"
              value={draft.happened_at}
              onChange={(event) => updateDraft("happened_at", event.target.value)}
              required
            />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="label">
              心情
              <input
                className="field"
                name="mood"
                value={draft.mood}
                onChange={(event) => updateDraft("mood", event.target.value)}
                maxLength={30}
              />
            </label>
            <label className="label">
              评分（探店/观影）
              <select
                className="field"
                name="rating"
                value={draft.rating}
                onChange={(event) => updateDraft("rating", event.target.value)}
              >
                <option value="">不评分</option>
                {[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} 星</option>)}
              </select>
            </label>
          </div>
          <label className="label">
            想说的话
            <textarea
              className="field min-h-32 resize-y"
              name="body"
              value={draft.body}
              onChange={(event) => updateDraft("body", event.target.value)}
              maxLength={5000}
            />
          </label>
          <fieldset className="grid gap-4 rounded-soft border border-line p-4">
            <legend className="px-2 text-sm font-semibold text-muted">地点（可选）</legend>
            <label className="label">
              地点名称
              <input
                className="field"
                name="place_name"
                placeholder="例如：青海湖、某家餐厅"
                value={draft.place_name}
                onChange={(event) => updateDraft("place_name", event.target.value)}
                maxLength={120}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="button-secondary"
                type="button"
                onClick={searchPlaceByName}
                disabled={geocodePending}
              >
                {geocodePending ? <LoaderCircle className="animate-spin" size={16} /> : <Search size={16} />}
                {geocodePending ? "搜索中" : "搜索地点"}
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={useCurrentLocation}
              >
                <Crosshair size={16} /> 使用当前位置
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() => setMapOpen((value) => !value)}
              >
                <MapPinned size={16} /> {mapOpen ? "收起地图" : "打开地图选择"}
              </button>
            </div>
            {geocodeResults.length > 0 && (
              <div className="grid gap-2 rounded-soft border border-line bg-[var(--color-surface-soft)] p-3">
                <p className="text-xs font-semibold text-muted">选择一个搜索结果：</p>
                {geocodeResults.map((result) => (
                  <button
                    key={`${result.latitude}:${result.longitude}:${result.displayName}`}
                    className="rounded-soft border border-line bg-[var(--color-surface)] p-3 text-left transition hover:-translate-y-0.5"
                    type="button"
                    onClick={() => chooseGeocodeResult(result)}
                  >
                    <span className="block text-sm font-semibold">{result.name || "未命名地点"}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted">{result.displayName}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {result.latitude}, {result.longitude}
                    </span>
                    <span className="mt-2 inline-flex rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-accent">
                      使用这个位置
                    </span>
                  </button>
                ))}
              </div>
            )}
            {looksLikeNullIsland(draft.latitude, draft.longitude) && (
              <div className="rounded-soft bg-[var(--color-amber-soft)] p-3 text-sm leading-6 text-[var(--color-amber)]">
                当前坐标接近 0,0，通常是误点到海面或搜索结果不正确。建议清空坐标后重新搜索城市/街道，或打开地图放大后再点选。
                <button className="review-text-button ml-2" type="button" onClick={clearCoordinates}>
                  清空坐标
                </button>
              </div>
            )}
            {locationError && (
              <p className="rounded-soft bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-danger)]">
                {locationError}
              </p>
            )}
            {mapOpen && (
              <LocationPicker
                value={{
                  latitude: draft.latitude,
                  longitude: draft.longitude,
                }}
                onChange={(next) => {
                  updateDraft("latitude", next.latitude);
                  updateDraft("longitude", next.longitude);
                  if (!draft.place_name.trim()) updateDraft("place_name", "地图选点");
                }}
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="label">
                纬度
                <input
                  className="field"
                  name="latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={draft.latitude}
                  onChange={(event) => updateDraft("latitude", event.target.value)}
                />
              </label>
              <label className="label">
                经度
                <input
                  className="field"
                  name="longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={draft.longitude}
                  onChange={(event) => updateDraft("longitude", event.target.value)}
                />
              </label>
            </div>
            <label className="label">
              坐标隐私
              <select
                className="field"
                name="privacy_level"
                value={draft.privacy_level}
                onChange={(event) =>
                  updateDraft(
                    "privacy_level",
                    event.target.value as EntryDraft["privacy_level"],
                  )
                }
              >
                <option value="exact">精确（公开景点/餐厅）</option>
                <option value="approximate">约 100 米</option>
                <option value="private">约 1 公里（住宅/住宿）</option>
              </select>
            </label>
            <p className="text-xs leading-5 text-muted">
              可手动填写坐标，也可以一键读取当前位置或打开地图点击选点。住宅、酒店等地点建议选择“约 1 公里”。
            </p>
          </fieldset>
          <label className="label">
            <span className="flex items-center gap-2"><ImagePlus size={17} /> 图片、视频或音频</span>
            <input
              className="field file:mr-3 file:border-0 file:bg-transparent file:font-semibold file:text-accent"
              name="media_files"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav"
              multiple
            />
            <span className="font-normal text-xs text-muted">最多 20 个；图片 20MB、视频 500MB、音频 100MB</span>
          </label>
          <p className="text-xs leading-5 text-muted">
            文字、时间和地点会自动保存到这台电脑的本地草稿；浏览器出于安全限制不能自动恢复已选择的文件。
          </p>
          {error && <p className="rounded-soft bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">{error}</p>}
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={onClose}>先不写了</button>
            <button type="submit" className="button-primary min-w-28" disabled={pending}>
              {pending && <LoaderCircle size={17} className="animate-spin" />}
              {pending ? "保存中" : "保存回忆"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
