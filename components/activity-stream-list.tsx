"use client";

import {
  Bell,
  Eye,
  Footprints,
  Heart,
  MessageCircle,
  MessageSquareReply,
  PencilLine,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  ActivityEventKind,
  ActivityStreamFilter,
  ActivityStreamItem,
} from "@/lib/database.types";
import { readApiJson } from "@/lib/http/read-api-json";
import { normalizeInternalPath } from "@/lib/security/internal-path";

const FILTERS: { value: ActivityStreamFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "message", label: "悄悄话" },
  { value: "interaction", label: "互动" },
  { value: "follow_up", label: "追评" },
  { value: "entry", label: "回忆" },
];

function formatTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.round(hours / 24)} 天前`;
}

function destination(item: ActivityStreamItem) {
  if (item.entry_id) {
    return item.kind === "follow_up_created" || item.kind === "follow_up_replied"
      ? `/memories/${item.entry_id}#follow-up-${item.source_id}`
      : `/memories/${item.entry_id}`;
  }
  return normalizeInternalPath(item.page_path);
}

function presentation(kind: ActivityEventKind) {
  switch (kind) {
    case "companion_message":
      return { label: "悄悄话", Icon: MessageCircle, text: "留下了一句悄悄话" };
    case "page_message":
      return { label: "页面留言", Icon: MessageCircle, text: "在这里留下了话" };
    case "reaction":
      return { label: "页面互动", Icon: Heart, text: "留下了反应" };
    case "summon":
      return { label: "召唤", Icon: Bell, text: "叫对方来看看" };
    case "co_presence":
      return { label: "同屏", Icon: Sparkles, text: "和你一起停在这里" };
    case "visit":
      return { label: "来过", Icon: Eye, text: "来过这里" };
    case "follow_up_created":
      return { label: "追评", Icon: MessageCircle, text: "追加了追评" };
    case "follow_up_replied":
      return { label: "回复追评", Icon: MessageSquareReply, text: "回复了追评" };
    case "entry_created":
      return { label: "发布回忆", Icon: Plus, text: "发布了回忆" };
    case "entry_updated":
      return { label: "修改回忆", Icon: PencilLine, text: "修改了回忆" };
  }
}

type StreamResponse = {
  items: ActivityStreamItem[];
  nextCursor: string | null;
};

export function ActivityStreamList({
  initialItems,
  initialNextCursor,
  filter,
}: {
  initialItems: ActivityStreamItem[];
  initialNextCursor: string | null;
  filter: ActivityStreamFilter;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(initialItems);
    setNextCursor(initialNextCursor);
    setError("");
  }, [initialItems, initialNextCursor]);

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ filter, before: nextCursor, limit: "24" });
      const response = await fetch(`/api/footprints?${params.toString()}`);
      const result = await readApiJson<StreamResponse>(
        response,
        "加载足迹失败。",
      );
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.items.filter((item) => !known.has(item.id))];
      });
      setNextCursor(result.nextCursor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载足迹失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  if (!items.length) {
    return (
      <div className="footprint-empty">
        <Footprints size={22} />
        <span>足迹流还很安静。打开右下角小窗，留下第一句话吧。</span>
      </div>
    );
  }

  return (
    <div>
      <nav className="activity-filter" aria-label="足迹类型筛选">
        {FILTERS.map((option) => (
          <Link
            key={option.value}
            href={option.value === "all" ? "/footprints#stream" : `/footprints?filter=${option.value}#stream`}
            className={filter === option.value ? "is-active" : ""}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <div className="activity-list">
        {items.map((item, index) => {
          const { Icon, label, text } = presentation(item.kind);
          const name = item.profile?.display_name ?? "我们";
          const href = destination(item);
          return (
            <article
              key={item.id}
              className={`activity-item is-${item.kind}`}
              style={index > 5 ? { contentVisibility: "auto", containIntrinsicSize: "112px" } : undefined}
            >
              <span className="activity-icon" aria-hidden="true"><Icon size={16} /></span>
              <div className="min-w-0">
                <div className="activity-heading">
                  <span className="activity-kind">{label}</span>
                  <span>{name} {text}</span>
                </div>
                {item.entry_title && <b className="activity-entry-title">《{item.entry_title}》</b>}
                {item.reaction && <p className="activity-reaction">「{item.reaction}」</p>}
                {item.body && <p className="activity-body">{item.body}</p>}
                <div className="activity-meta">
                  <time title={new Date(item.created_at).toLocaleString("zh-CN")}>{formatTime(item.created_at)}</time>
                  {href && (
                    <>
                      <span>·</span>
                      <Link href={href}>{item.page_title || item.entry_title || "打开这里"}</Link>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {nextCursor && (
        <div className="activity-load-more-wrap">
          <button type="button" className="activity-load-more" onClick={loadMore} disabled={loading}>
            {loading ? "正在加载" : "加载更早的足迹"}
          </button>
          {error && <p className="activity-load-error" aria-live="polite">{error}</p>}
        </div>
      )}
    </div>
  );
}
