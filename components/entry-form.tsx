"use client";

import { Crosshair, FileAudio, Film, ImagePlus, LoaderCircle, MapPinned, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmojiTextField } from "@/components/emoji-text-field";
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

const FORM_CATEGORY_LABELS: Record<EntryCategory, string> = {
  moment: "时间轴",
  diary: "日记",
  trip: "足迹",
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

type SelectedMediaPreview = {
  file: File;
  kind: MediaType | "file";
  url: string;
};

function localDateTime(iso?: string) {
  const date = iso ? new Date(iso) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function mediaKindForFile(file: File): SelectedMediaPreview["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMediaPreview[]>([]);
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

  useEffect(() => {
    const previews = selectedFiles.map((file) => ({
      file,
      kind: mediaKindForFile(file),
      url: URL.createObjectURL(file),
    }));
    setSelectedMedia(previews);
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [selectedFiles]);

  function updateDraft<K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function selectFiles(files: File[]) {
    const usableFiles = files.filter((file) => file.size > 0);
    if (usableFiles.length > 20) {
      setError("一次最多添加 20 个媒体文件。");
    } else {
      setError("");
    }
    setSelectedFiles(usableFiles.slice(0, 20));
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        formData.delete("media_files");
        const uploaded = await uploadFiles(selectedFiles);
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
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onClose();
        if (!entry && result.id) {
          router.push(`/memories/${result.id}`);
        }
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "保存失败，请稍后重试。");
      }
    });
  }

  const categoryOrder: EntryCategory[] = [
    "moment",
    "anniversary",
    "trip",
    "food",
    "diary",
    "watch",
    "first",
    "milestone",
  ];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="entry-form-title" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="entry-modal-card">
        <div className="entry-modal-header">
          <div>
            <h2 id="entry-form-title">
              {entry ? "编辑这段回忆" : "收藏一段新回忆"}
            </h2>
            <p>
              {entry?.profiles?.display_name
                ? `这段回忆由 ${entry.profiles.display_name} 写下；保存后会记录当前账号为最后编辑者。`
                : "把此刻好好放进你们的小星球。"}
            </p>
          </div>
          <button className="entry-close-button" type="button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="entry-form">
          <div className="entry-form-body">
            <input type="hidden" name="category" value={draft.category} />
            <div className="entry-form-section">
              <span className="entry-label">这是什么类型</span>
              <div className="entry-category-row">
                {categoryOrder.filter((category) => ENTRY_CATEGORIES.includes(category)).map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`entry-category-button ${draft.category === category ? "is-active" : ""}`}
                    onClick={() => updateDraft("category", category)}
                  >
                    {FORM_CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>
            </div>

            <label className="entry-label">
              标题
              <EmojiTextField
                name="title"
                value={draft.title}
                onChange={(value) => updateDraft("title", value)}
                placeholder="给这段回忆起个名字"
                maxLength={100}
                required
              />
            </label>

            <div className="entry-two-grid">
              <label className="entry-label">
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
              <label className="entry-label">
                心情
                <EmojiTextField
                  name="mood"
                  value={draft.mood}
                  onChange={(value) => updateDraft("mood", value)}
                  placeholder="🥰 幸福得冒泡"
                  maxLength={30}
                />
              </label>
            </div>

            <div className="entry-form-section">
              <input type="hidden" name="rating" value={draft.rating} />
              <div className="entry-rating-head">
                <span className="entry-label">评分</span>
                {draft.rating && (
                  <button type="button" onClick={() => updateDraft("rating", "")}>
                    清除评分
                  </button>
                )}
              </div>
              <div className="entry-stars" aria-label="评分">
                {[1, 2, 3, 4, 5].map((rating) => {
                  const active = Number(draft.rating) >= rating;
                  return (
                    <button
                      key={rating}
                      type="button"
                      className={active ? "is-active" : ""}
                      onClick={() => updateDraft("rating", String(rating))}
                      aria-label={`${rating} 星`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="entry-label">
              想说的话
              <EmojiTextField
                as="textarea"
                className="entry-textarea"
                name="body"
                value={draft.body}
                onChange={(value) => updateDraft("body", value)}
                placeholder="把当时的感受写下来…"
                maxLength={5000}
              />
            </label>

            <fieldset className="entry-location-card">
              <legend>地点</legend>
              <label className="entry-label">
                地点名称
              <EmojiTextField
                name="place_name"
                placeholder="地点名称，例如：崂山海边"
                value={draft.place_name}
                onChange={(value) => updateDraft("place_name", value)}
                maxLength={120}
              />
              </label>
              <div className="entry-location-actions">
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
                <div className="entry-geocode-list">
                  <p>选择一个搜索结果：</p>
                  {geocodeResults.map((result) => (
                    <button
                      key={`${result.latitude}:${result.longitude}:${result.displayName}`}
                      type="button"
                      onClick={() => chooseGeocodeResult(result)}
                    >
                      <b>{result.name || "未命名地点"}</b>
                      <span>{result.displayName}</span>
                      <em>{result.latitude}, {result.longitude}</em>
                    </button>
                  ))}
                </div>
              )}
              {looksLikeNullIsland(draft.latitude, draft.longitude) && (
                <div className="entry-warning">
                  当前坐标接近 0,0，通常是误点到海面或搜索结果不正确。建议清空坐标后重新搜索城市/街道。
                  <button type="button" onClick={clearCoordinates}>清空坐标</button>
                </div>
              )}
              {locationError && (
                <p className="entry-error">{locationError}</p>
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
              <div className="entry-coordinate-grid">
                <label className="entry-label">
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
                    placeholder="36.1073"
                  />
                </label>
                <label className="entry-label">
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
                    placeholder="120.4692"
                  />
                </label>
              </div>
              <label className="entry-label">
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
            </fieldset>

            <div className="entry-upload-card">
              <span className="entry-label">图片 / 视频 / 音频</span>
              <input
                ref={fileInputRef}
                className="entry-upload-control"
                name="media_files"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav"
                multiple
                onChange={(event) => selectFiles(Array.from(event.currentTarget.files ?? []))}
              />
              <button
                className="entry-upload-box"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  selectFiles(Array.from(event.dataTransfer.files));
                }}
              >
                <ImagePlus size={22} />
                <b>{selectedFiles.length ? `已选择 ${selectedFiles.length} 个文件` : "点击上传，或把文件拖到这里"}</b>
                <em>最多 20 个；图片 20MB、视频 500MB、音频 100MB</em>
              </button>
              {selectedMedia.length > 0 && (
                <div className="entry-selected-media" aria-live="polite">
                  {selectedMedia.map((item, index) => (
                    <div
                      className="entry-selected-media-item"
                      key={`${item.file.name}-${item.file.size}-${item.file.lastModified}-${index}`}
                    >
                      <div className="entry-selected-media-preview">
                        {item.kind === "image" ? (
                          <img src={item.url} alt="" />
                        ) : item.kind === "video" ? (
                          <video src={item.url} muted playsInline />
                        ) : item.kind === "audio" ? (
                          <FileAudio size={22} />
                        ) : (
                          <Film size={22} />
                        )}
                      </div>
                      <div className="entry-selected-media-copy">
                        <b title={item.file.name}>{item.file.name}</b>
                        <span>
                          {item.kind === "image"
                            ? "图片"
                            : item.kind === "video"
                              ? "视频"
                              : item.kind === "audio"
                                ? "音频"
                                : "文件"}{" "}
                          · {formatFileSize(item.file.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="entry-selected-media-remove"
                        onClick={() => removeSelectedFile(index)}
                        aria-label={`移除 ${item.file.name}`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="entry-draft-note">
              文字、时间和地点会自动保存到这台电脑的本地草稿；浏览器出于安全限制不能自动恢复已选择的文件。
            </p>
          </div>

          <div className="entry-modal-footer">
            <div className="entry-footer-error">
              {error ? <span>{error}</span> : null}
            </div>
            <div className="entry-footer-actions">
              <button type="button" className="button-secondary" onClick={onClose}>取消</button>
              <button type="submit" className="button-primary" disabled={pending}>
                {pending && <LoaderCircle size={17} className="animate-spin" />}
                {pending ? "保存中" : "保存回忆"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
