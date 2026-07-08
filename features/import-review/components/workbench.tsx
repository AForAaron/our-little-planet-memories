"use client";

import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CirclePause,
  Clock3,
  FileCheck2,
  GitMerge,
  ImageIcon,
  ListChecks,
  LoaderCircle,
  MapPin,
  Play,
  RefreshCw,
  Save,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
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

type StatusView = "review" | "approved" | "paused" | "rejected";
type KindFilter = "all" | "event" | "unclassified";

function mediaUrl(sourcePath: string) {
  return `/api/import-review/media?path=${encodeURIComponent(sourcePath)}`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "请求失败。");
  return result;
}

function reviewHeaders(reviewer: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-reviewer-label": encodeURIComponent(reviewer),
  };
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
  if (status === "approved") return "已批准";
  if (status === "rejected") return "已拒绝";
  if (status === "paused") return "暂时搁置";
  return "待审核";
}

function viewMatchesStatus(candidate: CandidateSummary, view: StatusView) {
  if (view === "review") return candidate.status === "draft";
  return candidate.status === view;
}

function sourceTypeLabel(sourceType: CandidateSummary["sourceType"]) {
  return sourceType === "photo"
    ? "照片"
    : sourceType === "mixed"
      ? "聊天 + 照片"
      : "聊天";
}

function privacyLabel(privacyLevel: PrivacyLevel) {
  return privacyLevel === "exact"
    ? "公开景点 · 精确"
    : privacyLevel === "private"
      ? "住宅/住宿 · 约 1 公里"
      : "未分类 · 约 100 米";
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    moment: "日常时刻",
    trip: "旅行",
    first: "第一次",
    milestone: "里程碑",
    diary: "共同日记",
  };
  return labels[category] ?? category;
}

function CandidateBadge({ candidate }: { candidate: CandidateSummary }) {
  return (
    <div className="review-candidate-meta">
      <span className={`review-chip is-${candidate.status}`}>{statusLabel(candidate.status)}</span>
      <span className="review-chip">{sourceTypeLabel(candidate.sourceType)}</span>
      <span className="review-chip">
        {candidate.messageCount} 消息 · {candidate.mediaCount} 媒体
      </span>
      <span className="review-chip is-score">分数 {candidate.score}</span>
    </div>
  );
}

function SectionHeading({
  index,
  title,
  meta,
}: {
  index: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="review-section-heading">
      <span>{index}</span>
      <h3>{title}</h3>
      {meta && <em>{meta}</em>}
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
          headers: reviewHeaders(reviewer),
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
    <div className="review-detail-stack">
      <section className="surface review-detail-card">
        <div className="review-detail-hero">
          <div>
            <span className="eyebrow">Candidate detail</span>
            <h2>整理这个记忆点</h2>
            <p>
              先确认边界，再整理标题、摘要、地点和精选媒体。只批准真正想进入网站的内容。
            </p>
          </div>
          <div className="review-action-bar">
            <button className="button-secondary review-action-button" type="button" onClick={() => save("rejected")} disabled={saving}>
              <X size={16} /> 拒绝
            </button>
            <button className="button-secondary review-action-button" type="button" onClick={() => save("paused")} disabled={saving}>
              <CirclePause size={16} /> 暂时搁置
            </button>
            <button className="button-secondary review-action-button" type="button" onClick={() => save()} disabled={saving}>
              <Save size={16} /> 保存
            </button>
            <button className="button-primary review-action-button" type="button" onClick={() => save("approved")} disabled={saving}>
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
              批准发布
            </button>
          </div>
        </div>

        {error && <p className="review-inline-error">{error}</p>}

        <div className="review-form-grid">
          {(candidate.lastEditedBy || candidate.reviewedBy) && (
            <div className="review-edit-meta">
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
          <div className="review-form-section md:col-span-2">
            <SectionHeading index="01" title="故事本身" meta="标题给人看，摘要给未来的你们看" />
            <label className="label">
              标题
              <input className="field" value={candidate.title} onChange={(event) => patch("title", event.target.value)} />
            </label>
            <label className="label">
              记忆摘要
              <textarea className="field min-h-28 resize-y" value={candidate.summary} onChange={(event) => patch("summary", event.target.value)} />
            </label>
          </div>
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

      <section className="surface review-detail-card">
        <div className="review-card-head">
          <SectionHeading index="02" title="章节路线" meta="按时间连接的地点预览" />
          {candidate.location && <span className="text-xs text-muted">{candidate.location.latitude}, {candidate.location.longitude}</span>}
        </div>
        <div className="mt-5">
          <RoutePreview candidates={routeCandidates} selectedId={candidate.id} />
        </div>
      </section>

      <section className="surface review-detail-card">
        <div className="review-card-head">
          <SectionHeading index="03" title="精选媒体" meta="只保留真正要进入网站的照片和视频" />
          <span className="review-count-badge">{selectedMedia.size}/{candidate.mediaPaths.length} 已选择</span>
        </div>
        {candidate.mediaPaths.length ? (
          <div className="review-media-grid">
            {candidate.mediaPaths.map((sourcePath, mediaIndex) => {
              const isImage = /\.(?:jpe?g|png|webp)$/i.test(sourcePath);
              const isSelected = selectedMedia.has(sourcePath);
              return (
                <article key={sourcePath} className={`review-media-card ${isSelected ? "is-selected" : "is-muted"}`}>
                  {candidate.sourceType === "photo" && mediaIndex > 0 && (
                    <button
                      className="review-media-split"
                      type="button"
                      onClick={() => onPhotoSplit(sourcePath)}
                    >
                      <Scissors size={12} /> 从这张照片拆分
                    </button>
                  )}
                  {isImage ? (
                    // Local-only review asset.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(sourcePath)} alt="" />
                  ) : /\.(?:wav|m4a)$/i.test(sourcePath) ? (
                    <div className="review-media-audio">
                      <Play size={24} />
                      <audio controls preload="none" src={mediaUrl(sourcePath)} className="w-full" />
                    </div>
                  ) : (
                    <div className="review-media-audio"><ImageIcon /></div>
                  )}
                  {candidate.coverPath === sourcePath && isSelected && <span className="review-cover-badge">封面</span>}
                  <div className="review-media-actions">
                    <label className="review-keep-toggle">
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

      <section className="surface review-detail-card">
        <div className="review-card-head">
          <SectionHeading index="04" title="原始消息" meta="勾选会随事件进入网站的聊天片段" />
          <span className="review-count-badge">{selectedMessages.size}/{detail.messages.length} 已选择</span>
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

function ReviewInspector({
  detail,
  overview,
}: {
  detail: CandidateDetail | null;
  overview: ReviewOverview;
}) {
  const candidate = detail?.candidate;
  const approved = overview.candidates.filter((item) => item.status === "approved");
  const approvedMedia = approved.reduce((total, item) => total + item.selectedMediaCount, 0);
  const approvedMessages = approved.reduce((total, item) => total + item.selectedMessageCount, 0);
  const approvedChapters = new Set(approved.map((item) => item.chapterId)).size;
  const selectedMedia = candidate?.selectedMediaPaths.length ?? 0;
  const selectedMessages = candidate?.selectedMessageIds.length ?? 0;
  const hasValidCover = Boolean(
    candidate?.coverPath && candidate.selectedMediaPaths.includes(candidate.coverPath),
  );
  const checks = candidate
    ? [
        {
          done: candidate.title.trim().length > 0,
          label: "标题非空",
          detail: candidate.title.trim() ? "已填写" : "请填写标题",
        },
        {
          done: candidate.summary.trim().length > 0,
          label: "摘要已整理",
          detail: candidate.summary.trim() ? "已填写" : "建议补一句可读叙事",
        },
        {
          done: selectedMedia > 0 || candidate.mediaPaths.length === 0,
          label: "精选媒体",
          detail: candidate.mediaPaths.length ? `${selectedMedia} 张已保留` : "无媒体候选",
        },
        {
          done: hasValidCover || candidate.mediaPaths.length === 0,
          label: "有效封面",
          detail: hasValidCover ? "封面已选" : "请选择保留媒体作为封面",
        },
        {
          done: Boolean(candidate.privacyLevel),
          label: "地点隐私",
          detail: privacyLabel(candidate.privacyLevel),
        },
      ]
    : [];

  return (
    <aside className="review-inspector">
      <section className="review-inspector-card">
        <div className="review-inspector-title">
          <ListChecks size={16} />
          审核检查
        </div>
        {candidate ? (
          <div className="review-check-list">
            {checks.map((check) => (
              <div key={check.label} className="review-check-row">
                <span className={check.done ? "is-done" : ""}>
                  {check.done ? <Check size={12} /> : <CircleAlert size={12} />}
                </span>
                <div>
                  <b>{check.label}</b>
                  <em>{check.detail}</em>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">选择一个候选事件后，这里会显示发布前检查项。</p>
        )}
      </section>

      <section className="review-inspector-card">
        <div className="review-inspector-title">
          <FileCheck2 size={16} />
          当前候选
        </div>
        {candidate ? (
          <dl className="review-inspector-data">
            <div><dt>状态</dt><dd>{statusLabel(candidate.status)}</dd></div>
            <div><dt>分类</dt><dd>{categoryLabel(candidate.category)}</dd></div>
            <div><dt>媒体</dt><dd>{selectedMedia}/{candidate.mediaPaths.length}</dd></div>
            <div><dt>消息</dt><dd>{selectedMessages}/{detail?.messages.length ?? 0}</dd></div>
            <div><dt>隐私</dt><dd>{privacyLabel(candidate.privacyLevel)}</dd></div>
          </dl>
        ) : (
          <p className="text-sm text-muted">暂无候选。</p>
        )}
      </section>

      <section className="review-inspector-card">
        <div className="review-inspector-title">
          <BarChart3 size={16} />
          发布清单
        </div>
        <dl className="review-publish-summary">
          <div><dt>已批准事件</dt><dd>{approved.length}</dd></div>
          <div><dt>媒体总数</dt><dd>{approvedMedia}</dd></div>
          <div><dt>消息总数</dt><dd>{approvedMessages}</dd></div>
          <div><dt>涉及章节</dt><dd>{approvedChapters}</dd></div>
        </dl>
      </section>
    </aside>
  );
}

export function ImportReviewWorkbench({
  reviewLabels = { self: "张张", partner: "沈沈" },
}: {
  reviewLabels?: { self: string; partner: string };
}) {
  const [overview, setOverview] = useState<ReviewOverview | null>(null);
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [statusView, setStatusView] = useState<StatusView>("review");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [dryRun, setDryRun] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, startLoading] = useTransition();
  const [reviewer, setReviewer] = useState(reviewLabels.self);

  useEffect(() => {
    const saved = window.localStorage.getItem("little-planet-reviewer");
    const allowed = new Set([reviewLabels.self, reviewLabels.partner]);
    if (saved && allowed.has(saved)) {
      setReviewer(saved);
      return;
    }
    setReviewer(reviewLabels.self);
    window.localStorage.setItem("little-planet-reviewer", reviewLabels.self);
  }, [reviewLabels.self, reviewLabels.partner]);

  function chooseReviewer(value: string) {
    setReviewer(value);
    window.localStorage.setItem("little-planet-reviewer", value);
  }

  const loadOverview = useCallback(async () => {
    const next = await api<ReviewOverview>("/api/import-review/overview");
    setOverview(next);
    setSelectedId((current) => current ?? next.candidates.find((candidate) => candidate.status === "draft")?.id ?? null);
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
      const matchesStatus = viewMatchesStatus(candidate, statusView);
      const matchesKind = kindFilter === "all" || candidate.classification === kindFilter;
      const matchesQuery =
        !normalizedQuery ||
        `${candidate.title} ${candidate.summary} ${candidate.placeName} ${(candidate.keywords ?? []).join(" ")}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesStatus && matchesKind && matchesQuery;
    });
  }, [overview, statusView, kindFilter, query]);
  const pageSize = 60;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleCandidates = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => setPage(0), [statusView, kindFilter, query]);
  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);
  useEffect(() => {
    if (!overview) return;
    if (!filtered.length) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    if (!selectedId || !filtered.some((candidate) => candidate.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, overview, selectedId]);
  useEffect(() => {
    const visibleIds = new Set(filtered.map((candidate) => candidate.id));
    setSelectedForMerge((current) => {
      const next = statusView === "review"
        ? new Set([...current].filter((id) => visibleIds.has(id)))
        : new Set<string>();
      return next.size === current.size && [...next].every((id) => current.has(id))
        ? current
        : next;
    });
  }, [filtered, statusView]);

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
          headers: reviewHeaders(reviewer),
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
      headers: reviewHeaders(reviewer),
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
        headers: reviewHeaders(reviewer),
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
  const paused = overview.candidates.filter((candidate) => candidate.status === "paused").length;
  const rejected = overview.candidates.filter((candidate) => candidate.status === "rejected").length;
  const statusCounts: Record<StatusView, number> = {
    review: draft,
    approved,
    paused,
    rejected,
  };
  const currentStatusCandidates = overview.candidates.filter((candidate) =>
    viewMatchesStatus(candidate, statusView),
  );
  const kindCounts: Record<KindFilter, number> = {
    all: currentStatusCandidates.length,
    event: currentStatusCandidates.filter((candidate) => candidate.classification === "event").length,
    unclassified: currentStatusCandidates.filter((candidate) => candidate.classification === "unclassified").length,
  };
  const stats = [
    { label: "全部候选", value: overview.candidates.length, icon: ListChecks, tone: "neutral" },
    { label: "待审核", value: draft, icon: Clock3, tone: "pending" },
    { label: "已批准", value: approved, icon: CheckCircle2, tone: "approved" },
    { label: "暂时搁置", value: paused, icon: CirclePause, tone: "paused" },
    { label: "章节", value: overview.chapters.length, icon: ShieldCheck, tone: "chapter" },
  ];
  const dryRunRecord = dryRun ?? {};

  return (
    <main className="review-shell">
      <header className="review-topbar">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Local memory studio</span>
          <h1 className="mt-2 font-heading text-2xl font-bold">本地记忆审核台</h1>
          <p className="mt-1 text-xs text-muted">原始数据不会上传；只有批准事件才会进入发布清单。</p>
        </div>
        <div className="review-toolbar-actions">
          <div className="reviewer-switch" aria-label="审核人">
            <span><UserRound size={13} /> 审核人</span>
            {[reviewLabels.self, reviewLabels.partner].map((name) => (
              <button
                key={name}
                type="button"
                className={reviewer === name ? "is-active" : ""}
                onClick={() => chooseReviewer(name)}
              >
                <i />
                {name}
              </button>
            ))}
          </div>
          <button className="button-secondary" onClick={() => startLoading(refresh)} disabled={loading}><RefreshCw size={16} />刷新</button>
          <button className="button-primary" onClick={showDryRun} disabled={loading}><Play size={16} />发布预览</button>
        </div>
      </header>

      {error && <div className="review-global-error"><CircleAlert size={16} />{error}<button onClick={() => setError("")}><X size={14} /></button></div>}

      <section className="review-stats">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <span key={item.label} className={`review-stat-card is-${item.tone}`}>
              <i><Icon size={15} /></i>
              <span><b>{item.value}</b>{item.label}</span>
            </span>
          );
        })}
      </section>

      <div className="review-layout">
        <aside className="review-sidebar">
          <div className="review-sidebar-tools">
            <label className="review-search">
              <Search size={16} />
              <input placeholder="搜索标题、地点或关键词" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="review-filter-row">
              {([
                ["review", "待审核"],
                ["approved", "已批准"],
                ["paused", "暂时搁置"],
                ["rejected", "已拒绝"],
              ] as [StatusView, string][]).map(([value, label]) => (
                <button key={value} className={`review-filter ${statusView === value ? "is-active" : ""}`} onClick={() => setStatusView(value)}>
                  {label}
                  <span>{statusCounts[value]}</span>
                </button>
              ))}
            </div>
            <div className="review-filter-row">
              {([
                ["all", "全部"],
                ["event", "事件"],
                ["unclassified", "碎片"],
              ] as [KindFilter, string][]).map(([value, label]) => (
                <button key={value} className={`review-filter ${kindFilter === value ? "is-active" : ""}`} onClick={() => setKindFilter(value)}>
                  {label}
                  <span>{kindCounts[value]}</span>
                </button>
              ))}
            </div>
            {statusView === "review" && selectedForMerge.size > 1 && (
              <button className="button-primary" onClick={merge} disabled={loading}><GitMerge size={16} />合并 {selectedForMerge.size} 个事件</button>
            )}
            <div className="review-list-pager">
              <span>{filtered.length} 条 · 第 {page + 1}/{pageCount} 页</span>
              <div className="flex gap-1">
                <button className="button-secondary size-8 !min-h-0 !p-0" disabled={page === 0} onClick={() => setPage((value) => value - 1)} aria-label="上一页"><ChevronLeft size={14} /></button>
                <button className="button-secondary size-8 !min-h-0 !p-0" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} aria-label="下一页"><ChevronRight size={14} /></button>
              </div>
            </div>
          </div>
          <div className="review-candidate-list">
            {visibleCandidates.map((candidate) => (
              <article key={candidate.id} className={`review-candidate ${candidate.id === selectedId ? "is-active" : ""}`}>
                <div className="flex gap-3">
                  {statusView === "review" && (
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
                  )}
                  <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(candidate.id)}>
                    <div className="review-candidate-kicker">
                      <time>{formatTime(candidate.startAt)}</time>
                      <span>{candidate.classification === "event" ? "事件" : "碎片"}</span>
                    </div>
                    <h2>{candidate.title}</h2>
                    {candidate.lastEditedBy && (
                      <p className="review-candidate-edited">
                        {candidate.lastEditedBy} 编辑
                        {candidate.lastEditedAt ? ` · ${formatTime(candidate.lastEditedAt)}` : ""}
                      </p>
                    )}
                    <CandidateBadge candidate={candidate} />
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
          <section className="modal-card review-publish-modal p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="eyebrow">Dry run</span>
                <h2 className="mt-2 font-heading text-2xl font-bold">发布预览</h2>
              </div>
              <button className="button-secondary size-10 !p-0" onClick={() => setDryRun(null)}><X size={16} /></button>
            </div>
            <div className="review-dryrun-grid">
              {([
                ["事件", dryRunRecord.events],
                ["章节", dryRunRecord.chapters],
                ["媒体", dryRunRecord.media],
                ["消息", dryRunRecord.messages],
                ["语音", dryRunRecord.voices],
                ["原始媒体 MiB", dryRunRecord.originalMediaMiB],
              ] satisfies Array<[string, unknown]>).map(([label, value]) => (
                <div key={label} className="review-dryrun-card">
                  <b>{String(value ?? 0)}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <pre className="review-dryrun-json">{JSON.stringify(dryRun, null, 2)}</pre>
            <p className="mt-4 text-sm text-muted">这只是预览，不会连接 Neon 或 R2。</p>
          </section>
        </div>
      )}
    </main>
  );
}
