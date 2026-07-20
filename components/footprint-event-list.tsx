import { Bell, Eye, Footprints, Heart, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import type { FootprintEvent } from "@/lib/database.types";
import { normalizeInternalPath } from "@/lib/security/internal-path";

function formatRelative(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

function iconFor(event: FootprintEvent) {
  if (event.event_type === "message") return MessageCircle;
  if (event.event_type === "reaction") return Heart;
  if (event.event_type === "summon") return Bell;
  if (event.event_type === "co_presence") return Sparkles;
  if (event.event_type === "visit") return Eye;
  return Footprints;
}

function textFor(event: FootprintEvent) {
  const name = event.profile?.display_name ?? "我们";
  if (event.event_type === "message") {
    return `${name} 留下：${event.body ?? ""}`;
  }
  if (event.event_type === "reaction") {
    return `${name} 对这里点了「${event.reaction ?? "记得"}」`;
  }
  if (event.event_type === "summon") {
    return `${name} 叫你来看看这里`;
  }
  if (event.event_type === "co_presence") {
    return event.body ?? "你们刚才一起停在这里";
  }
  return `${name} 来过这里`;
}

export function FootprintEventList({
  events,
  compact = false,
  emptyText = "这里还没有足迹。",
}: {
  events: FootprintEvent[];
  compact?: boolean;
  emptyText?: string;
}) {
  if (!events.length) {
    return (
      <div className="footprint-empty">
        <Footprints size={22} />
        <span>{emptyText}</span>
      </div>
    );
  }

  return (
    <div className={compact ? "footprint-list is-compact" : "footprint-list"}>
      {events.map((event) => {
        const Icon = iconFor(event);
        const href = normalizeInternalPath(event.page_path);
        return (
          <article key={event.id} className="footprint-item">
            <span className="footprint-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <div className="min-w-0">
              <p>{textFor(event)}</p>
              <div className="footprint-meta">
                <time>{formatRelative(event.created_at)}</time>
                {href && (
                  <>
                    <span>·</span>
                    <Link href={href}>{event.page_title || "打开这里"}</Link>
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
