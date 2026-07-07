"use client";

import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  GitMerge,
  ImageIcon,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Play,
  RefreshCw,
  Save,
  Scissors,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ChatBubbleThread } from "@/components/chat-bubble-thread";
import type {
  CandidateDetail,
  CandidatePatch,
  CandidateSummary,
  Chapter,
  NormalizedMessage,
  PrivacyLevel,
  ReviewOverview,
  ReviewStatus,
} from "@/features/import-review/types";

type Filter = "all" | ReviewStatus | "event" | "unclassified";

function mediaUrl(sourcePath: string) {
  return `/api/import-review/media?path=${encodeURIComponent(sourcePath)}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "请求失败。");
  return result;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function dateInputValue(value: string) {
  const date = new Date(value);
  const offset = 8 * 60 * 60 * 1_000;
  return new Date(date.getTime() + offset).toISOString().slice(0, 16);
}

function dateInputToIso(value: string) {
  return new Date(`${value}:00+08:00`).toISOString();
}

function statusLabel(status: ReviewStatus) {
  return status === "approved" ? "已批准" : status === "rejected" ? "已拒绝" : "待审核";
}

function CandidateBadge({ candidate }: { candidate: CandidateSummary }) {
  return (
    <div className="flex flex-wrap gap-2 text-[.68rem]">
      <span className="review-chip">{statusLabel(candidate.status)}</span>
      <span className="review-chip">
        {candidate.sourceType === "photo"
          ? "照片"
          : candidate.sourceType === "mixed"
            ? "聊天 + 照片"
            : "聊天"}
      </span>
      <span className="review-chip">
        {candidate.messageCount} 消息 · {candidate.mediaCount} 媒体
      </span>
      <span className="review-chip">分数 {candidate.score}</span>
    </div>
  );
}

function RoutePreview({
  candidates,
  selectedId,
}: {
  candidates: CandidateSummary[];
  selectedId?: string;
}) {
  const points = candidates
    .filter((candidate) => candidate.location)
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
  if (!points.length) {
    return (
      <div className="review-map-empty">
        <MapPin size={20} />
        这个章节还没有已脱敏坐标
      </div>
    );
  }
  const latitudes = points.map((point) => point.location!.latitude);
  const longitudes = points.map((point) => point.location!.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const project = (candidate: CandidateSummary) => {
    const x =
      8 +
      ((candidate.location!.longitude - minLongitude) /
        (maxLongitude - minLongitude || 1)) *
        84;
    const y =
      92 -
      ((candidate.location!.latitude - minLatitude) /
        (maxLatitude - minLatitude || 1)) *
        84;
    return { x, y };
  };
  const path = points.map((point) => project(point)).map(({ x, y }) => `${x},${y}`).join(" ");

  return (
    <div>
      <svg className="review-route-map" viewBox="0 0 100 100" role="img" aria-label="按时间连接的路线点">
        <polyline points={path} fill="none" stroke="var(--color-accent)" strokeWidth="1.3" strokeDasharray="3 2" />
        {points.map((point, index) => {
          const { x, y } = project(point);
          const active = point.id === selectedId;
          return (
            <g key={point.id}>
              <circle cx={x} cy={y} r={active ? 4 : 3} fill={active ? "var(--color-accent-strong)" : "var(--color-surface)"} stroke="var(--color-accent)" strokeWidth="1.2" />
              <text x={x} y={y + 1.3} textAnchor="middle" fontSize="3.3" fill={active ? "var(--color-on-accent)" : "var(--color-text)"}>
                {index + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-muted">虚线仅表示拍摄时间顺序，不代表真实行驶路线。</p>
    </div>
  );
}

function DetailEditor({
  detail,
  chapters,
  routeCandidates,
  reviewer,
  reviewLabels,
  onSaved,
  onSplit,
  onPhotoSplit,
}: {
  detail: CandidateDetail;
  chapters: Chapter[];
  routeCandidates: CandidateSummary[];
  reviewer: string;
  reviewLabels: { self: string; partner: string };
  onSaved: () => Promise<void>;
  onSplit: (messageId: string) => Promise<void>;
  onPhotoSplit: (sourcePath: string) => Promise<void>;
}) {
  const [candidate, setCandidate] = useState(detail.candidate);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => setCandidate(detail.candidate), [detail]);

  function patch<K extends keyof typeof candidate>(key: K, value: (typeof candidate)[K]) {
    setCandidate((current) => ({ ...current, [key]: value }));
  }

  function save(status?: ReviewStatus) {
    setError("");
    startSaving(async () => {
      try {
        const nextStatus = status ?? candidate.status;
        const body: CandidatePatch = {
          revision: candidate.revision ?? 0,
          chapterId: candidate.chapterId,
          title: candidate.title,
          summary: candidate.summary,
          category: candidate.category,
          startAt: candidate.startAt,
          endAt: candidate.endAt,
          status: nextStatus,
          selectedMessageIds: candidate.selectedMessageIds,
          selectedMediaPaths: candidate.selectedMediaPaths,
          coverPath: candidate.coverPath,
          placeName: candidate.placeName,
          privacyLevel: candidate.privacyLevel,
          reviewNotes: candidate.reviewNotes ?? "",
        };
        const result = await api<{ candidate: typeof candidate }>(`/api/import-review/candidate/${encodeURIComponent(candidate.id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-reviewer-label": reviewer,
          },
          body: JSON.stringify(body),
        });
        setCandidate(result.candidate);
        await onSaved();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "保存失败。");
      }
    });
  }

  const selectedMessages = new Set(candidate.selectedMessageIds);
  const selectedMedia = new Set(candidate.selectedMediaPaths);

  return (
    <div className="grid gap-6">
      <section className="surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="eyebrow">Candidate detail</span>
            <h2 className="mt-2 font-heading text-2xl font-bold">整理这个记忆点</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" type="button" onClick={() => save("rejected")} disabled={saving}>
              <X size={16} /> 拒绝
            </button>
            <button className="button-secondary" type="button" onClick={() => save()} disabled={saving}>
              <Save size={16} /> 保存
            </button>
            <button className="button-primary" type="button" onClick={() => save("approved")} disabled={saving}>
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
              批准发布
            </button>
          </div>
        </div>

        {error && <p className="mt-4 rounded-soft bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {(candidate.lastEditedBy || candidate.reviewedBy) && (
            <div className="md:col-span-2 rounded-soft bg-[var(--color-surface-soft)] p-3 text-xs leading-6 text-muted">
              {candidate.lastEditedBy && (
                <span>
                  最后编辑：{candidate.lastEditedBy}
                  {candidate.lastEditedAt ? ` · ${formatTime(candidate.lastEditedAt)}` : ""}
                </span>
              )}
              {candidate.reviewedBy && (
                <span className="ml-3">
                  审核决定：{candidate.reviewedBy}
                  {candidate.reviewedAt ? ` · ${formatTime(candidate.reviewedAt)}` : ""}
                </span>
              )}
              <span className="ml-3">版本 {candidate.revision ?? 0}</span>
            </div>
          )}
          <label className="label md:col-span-2">
            标题
            <input className="field" value={candidate.title} onChange={(event) => patch("title", event.target.value)} />
          </label>
          <label className="label md:col-span-2">
            记忆摘要
            <textarea className="field min-h-28 resize-y" value={candidate.summary} onChange={(event) => patch("summary", event.target.value)} />
          </label>
          <label className="label">
            所属章节
            <select className="field" value={candidate.chapterId} onChange={(event) => patch("chapterId", event.target.value)}>
              {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
            </select>
          </label>
          <label className="label">
            分类
            <select className="field" value={candidate.category} onChange={(event) => patch("category", event.target.value)}>
              <option value="moment">日常时刻</option>
              <option value="trip">旅行</option>
              <option value="first">第一次</option>
              <option value="milestone">里程碑</option>
              <option value="diary">共同日记</option>
            </select>
          </label>
          <label className="label">
            开始时间
            <input className="field" type="datetime-local" value={dateInputValue(candidate.startAt)} onChange={(event) => patch("startAt", dateInputToIso(event.target.value))} />
          </label>
          <label className="label">
            结束时间
            <input className="field" type="datetime-local" value={dateInputValue(candidate.endAt)} onChange={(event) => patch("endAt", dateInputToIso(event.target.value))} />
          </label>
          <label className="label">
            地点名称
            <input className="field" value={candidate.placeName} placeholder="由你确认，不发送坐标给外部服务" onChange={(event) => patch("placeName", event.target.value)} />
          </label>
          <label className="label">
            地点隐私
            <select className="field" value={candidate.privacyLevel} onChange={(event) => patch("privacyLevel", event.target.value as PrivacyLevel)}>
              <option value="exact">公开景点 · 精确</option>
              <option value="approximate">未分类 · 约 100 米</option>
              <option value="private">住宅/住宿 · 约 1 公里</option>
            </select>
          </label>
          <label className="label md:col-span-2">
            审核备注
            <textarea className="field min-h-20 resize-y" value={candidate.reviewNotes ?? ""} onChange={(event) => patch("reviewNotes", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="surface p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="eyebrow">Route</span>
            <h3 className="mt-2 font-heading text-xl font-bold">章节路线</h3>
          </div>
          {candidate.location && <span className="text-xs text-muted">{candidate.location.latitude}, {candidate.location.longitude}</span>}
        </div>
        <div className="mt-5">
          <RoutePreview candidates={routeCandidates} selectedId={candidate.id} />
        </div>
      </section>

      <section className="surface p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="eyebrow">Media</span>
            <h3 className="mt-2 font-heading text-xl font-bold">精选媒体</h3>
          </div>
          <span className="text-xs text-muted">{selectedMedia.size}/{candidate.mediaPaths.length} 已选择</span>
        </div>
        {candidate.mediaPaths.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {candidate.mediaPaths.map((sourcePath, mediaIndex) => {
              const isImage = /\.(?:jpe?g|png|webp)$/i.test(sourcePath);
              const isSelected = selectedMedia.has(sourcePath);
              return (
                <article key={sourcePath} className={`review-media-card ${isSelected ? "" : "opacity-45"}`}>
                  {candidate.sourceType === "photo" && mediaIndex > 0 && (
                    <button
                      className="review-text-button m-2"
                      type="button"
                      onClick={() => onPhotoSplit(sourcePath)}
                    >
                      <Scissors size={12} /> 从这张照片拆分
                    </button>
                  )}
                  {isImage ? (
                    // Local-only review asset.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(sourcePath)} alt="" className="h-40 w-full object-cover" />
                  ) : /\.(?:wav|m4a)$/i.test(sourcePath) ? (
                    <div className="grid h-40 place-items-center bg-[var(--color-surface-soft)] p-3">
                      <Play size={24} />
                      <audio controls preload="none" src={mediaUrl(sourcePath)} className="w-full" />
                    </div>
                  ) : (
                    <div className="grid h-40 place-items-center bg-[var(--color-surface-soft)]"><ImageIcon /></div>
                  )}
                  <div className="grid gap-2 p-3">
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={isSelected} onChange={() => {
                        const next = new Set(selectedMedia);
                        if (next.has(sourcePath)) next.delete(sourcePath); else next.add(sourcePath);
                        patch("selectedMediaPaths", [...next]);
                      }} />
                      保留
                    </label>
                    {isImage && isSelected && (
                      <button type="button" className="review-text-button" onClick={() => patch("coverPath", sourcePath)}>
                        {candidate.coverPath === sourcePath ? <Check size={12} /> : <ImageIcon size={12} />}
                        {candidate.coverPath === sourcePath ? "当前封面" : "设为封面"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p className="mt-5 text-sm text-muted">这个候选事件没有可用媒体。</p>}
      </section>

      <section className="surface p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="eyebrow">Original messages</span>
            <h3 className="mt-2 font-heading text-xl font-bold">原始消息</h3>
          </div>
          <span className="text-xs text-muted">{selectedMessages.size}/{detail.messages.length} 已选择</span>
        </div>
        {detail.messages.length ? (
          <div className="mt-5">
            <ChatBubbleThread
              mode="review"
              messages={detail.messages}
              selectedIds={selectedMessages}
              selectedMediaPaths={selectedMedia}
              selfLabel={reviewLabels.self}
              partnerLabel={reviewLabels.partner}
              getMediaUrl={(media) => media.sourcePath ? mediaUrl(media.sourcePath) : ""}
              canSplit={(_, index) => index > 0}
              onToggleMessage={(messageId) => {
                const next = new Set(selectedMessages);
                if (next.has(messageId)) next.delete(messageId); else next.add(messageId);
                patch("selectedMessageIds", [...next]);
              }}
              onSplitMessage={onSplit}
            />
          </div>
        ) : <p className="mt-5 text-sm text-muted">照片事件没有聊天原文。</p>}
      </section>
    </div>
  );
}

export function ImportReviewWorkbench({
  reviewLabels = { self: "我", partner: "她" },
}: {
  reviewLabels?: { self: string; partner: string };
}) {
  const [overview, setOverview] = useState<ReviewOverview | null>(null);
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [dryRun, setDryRun] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, startLoading] = useTransition();
  const [reviewer, setReviewer] = useState(reviewLabels.self);

  useEffect(() => {
    const saved = window.localStorage.getItem("little-planet-reviewer");
    if (saved) setReviewer(saved);
  }, []);

  function chooseReviewer(value: string) {
    setReviewer(value);
    window.localStorage.setItem("little-planet-reviewer", value);
  }

  const loadOverview = useCallback(async () => {
    const next = await api<ReviewOverview>("/api/import-review/overview");
    setOverview(next);
    setSelectedId((current) => current ?? next.candidates[0]?.id ?? null);
  }, []);

  useEffect(() => {
    startLoading(async () => {
      try {
        await loadOverview();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "无法读取审核数据。");
      }
    });
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedId) return;
    startLoading(async () => {
      try {
        const next = await api<CandidateDetail>(`/api/import-review/candidate/${encodeURIComponent(selectedId)}`);
        setDetail(next);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "无法读取候选详情。");
      }
    });
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (!overview) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return overview.candidates.filter((candidate) => {
      const matchesFilter =
        filter === "all" ||
        candidate.status === filter ||
        candidate.classification === filter;
      const matchesQuery =
        !normalizedQuery ||
        `${candidate.title} ${candidate.summary} ${candidate.placeName} ${(candidate.keywords ?? []).join(" ")}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [overview, filter, query]);
  const pageSize = 60;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleCandidates = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => setPage(0), [filter, query]);
  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  const routeCandidates = useMemo(
    () =>
      overview?.candidates.filter(
        (candidate) => candidate.chapterId === detail?.candidate.chapterId,
      ) ?? [],
    [overview, detail],
  );

  async function refresh() {
    await loadOverview();
    if (selectedId) {
      setDetail(await api(`/api/import-review/candidate/${encodeURIComponent(selectedId)}`));
    }
  }

  function merge() {
    startLoading(async () => {
      try {
        const result = await api<{ candidate: CandidateSummary }>("/api/import-review/merge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-reviewer-label": reviewer,
          },
          body: JSON.stringify({ ids: [...selectedForMerge] }),
        });
        setSelectedForMerge(new Set());
        setSelectedId(result.candidate.id);
        await loadOverview();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "合并失败。");
      }
    });
  }

  async function split(messageId: string) {
    if (!detail || !window.confirm("从这条消息开始拆成一个新的候选事件？")) return;
    const result = await api<{ candidates: CandidateSummary[] }>("/api/import-review/split", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-reviewer-label": reviewer,
      },
      body: JSON.stringify({
        candidateId: detail.candidate.id,
        splitMessageId: messageId,
      }),
    });
    setSelectedId(result.candidates[0].id);
    await loadOverview();
  }

  async function splitPhoto(sourcePath: string) {
    if (!detail || !window.confirm("从这张照片开始拆成一个新的照片事件？")) return;
    const result = await api<{ candidates: CandidateSummary[] }>(
      "/api/import-review/split-photos",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-reviewer-label": reviewer,
        },
        body: JSON.stringify({
          candidateId: detail.candidate.id,
          splitPhotoPath: sourcePath,
        }),
      },
    );
    setSelectedId(result.candidates[0].id);
    await loadOverview();
  }

  function showDryRun() {
    startLoading(async () => {
      try {
        setDryRun(await api("/api/import-review/dry-run"));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "无法生成发布预览。");
      }
    });
  }

  if (!overview && loading) {
    return <main className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin text-accent" size={32} /></main>;
  }

  if (!overview) {
    return (
      <main className="page-shell py-16">
        <div className="surface mx-auto max-w-xl p-8 text-center">
          <CircleAlert className="mx-auto text-[var(--color-danger)]" />
          <h1 className="mt-4 font-heading text-2xl font-bold">审核数据还没有准备好</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{error || "请先运行 npm run data:prepare。"}</p>
        </div>
      </main>
    );
  }

  const approved = overview.candidates.filter((candidate) => candidate.status === "approved").length;
  const draft = overview.candidates.filter((candidate) => candidate.status === "draft").length;

  return (
    <main className="review-shell">
      <header className="review-topbar">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Local memory studio</span>
          <h1 className="mt-2 font-heading text-2xl font-bold">本地记忆审核台</h1>
          <p className="mt-1 text-xs text-muted">原始数据不会上传；只有批准事件才会进入发布清单。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="label !flex !grid-cols-none !flex-row items-center gap-2 text-xs">
            审核人
            <select className="field !min-h-0 !w-auto !py-2 text-xs" value={reviewer} onChange={(event) => chooseReviewer(event.target.value)}>
              <option value={reviewLabels.self}>{reviewLabels.self}</option>
              <option value={reviewLabels.partner}>{reviewLabels.partner}</option>
            </select>
          </label>
          <button className="button-secondary" onClick={() => startLoading(refresh)} disabled={loading}><RefreshCw size={16} />刷新</button>
          <button className="button-primary" onClick={showDryRun} disabled={loading}><Play size={16} />发布预览</button>
        </div>
      </header>

      {error && <div className="review-global-error"><CircleAlert size={16} />{error}<button onClick={() => setError("")}><X size={14} /></button></div>}

      <section className="review-stats">
        <span><b>{overview.candidates.length}</b> 全部候选</span>
        <span><b>{draft}</b> 待审核</span>
        <span><b>{approved}</b> 已批准</span>
        <span><b>{overview.chapters.length}</b> 章节</span>
      </section>

      <div className="review-layout">
        <aside className="review-sidebar">
          <div className="sticky top-0 z-10 grid gap-3 bg-background pb-4">
            <input className="field" placeholder="搜索标题、地点或关键词" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="flex flex-wrap gap-2">
              {([
                ["all", "全部"],
                ["draft", "待审核"],
                ["approved", "已批准"],
                ["event", "事件"],
                ["unclassified", "碎片"],
              ] as [Filter, string][]).map(([value, label]) => (
                <button key={value} className={`review-filter ${filter === value ? "is-active" : ""}`} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
            {selectedForMerge.size > 1 && (
              <button className="button-primary" onClick={merge} disabled={loading}><GitMerge size={16} />合并 {selectedForMerge.size} 个事件</button>
            )}
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>{filtered.length} 条 · 第 {page + 1}/{pageCount} 页</span>
              <div className="flex gap-1">
                <button className="button-secondary size-8 !min-h-0 !p-0" disabled={page === 0} onClick={() => setPage((value) => value - 1)} aria-label="上一页"><ChevronLeft size={14} /></button>
                <button className="button-secondary size-8 !min-h-0 !p-0" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} aria-label="下一页"><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            {visibleCandidates.map((candidate) => (
              <article key={candidate.id} className={`review-candidate ${candidate.id === selectedId ? "is-active" : ""}`}>
                <div className="flex gap-3">
                  <input
                    type="checkbox"
                    checked={selectedForMerge.has(candidate.id)}
                    onChange={() => {
                      const next = new Set(selectedForMerge);
                      if (next.has(candidate.id)) next.delete(candidate.id); else next.add(candidate.id);
                      setSelectedForMerge(next);
                    }}
                    aria-label="选择合并"
                  />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(candidate.id)}>
                    <time className="text-xs text-muted">{formatTime(candidate.startAt)}</time>
                    <h2 className="mt-1 line-clamp-2 font-heading font-bold">{candidate.title}</h2>
                    {candidate.lastEditedBy && (
                      <p className="mt-1 text-[.68rem] text-muted">
                        {candidate.lastEditedBy} 编辑
                        {candidate.lastEditedAt ? ` · ${formatTime(candidate.lastEditedAt)}` : ""}
                      </p>
                    )}
                    <div className="mt-3"><CandidateBadge candidate={candidate} /></div>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          {loading && !detail ? (
            <div className="surface grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-accent" /></div>
          ) : detail ? (
            <DetailEditor
              detail={detail}
              chapters={overview.chapters}
              routeCandidates={routeCandidates}
              reviewer={reviewer}
              reviewLabels={reviewLabels}
              onSaved={refresh}
              onSplit={split}
              onPhotoSplit={splitPhoto}
            />
          ) : (
            <div className="surface grid min-h-64 place-items-center text-muted">选择一个候选事件开始整理</div>
          )}
        </section>
      </div>

      {dryRun && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDryRun(null)}>
          <section className="modal-card p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="eyebrow">Dry run</span>
                <h2 className="mt-2 font-heading text-2xl font-bold">发布预览</h2>
              </div>
              <button className="button-secondary size-10 !p-0" onClick={() => setDryRun(null)}><X size={16} /></button>
            </div>
            <pre className="mt-6 max-h-[60vh] overflow-auto rounded-soft bg-[var(--color-surface-soft)] p-4 text-xs leading-6">{JSON.stringify(dryRun, null, 2)}</pre>
            <p className="mt-4 text-sm text-muted">这只是预览，不会连接 Neon 或 R2。</p>
          </section>
        </div>
      )}
    </main>
  );
}
