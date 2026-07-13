import { ArrowLeft, CalendarDays, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatBubbleThread } from "@/components/chat-bubble-thread";
import { EntryAttentionMarker } from "@/components/entry-attention-marker";
import { EntryFollowUps } from "@/components/entry-follow-ups";
import { PageFootprints } from "@/components/page-footprints";
import { getEntryFollowUps } from "@/lib/data/entry-follow-ups";
import { getMemoryDetail } from "@/lib/data/memories";
import type { Media } from "@/lib/database.types";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  moment: "时间轴",
  diary: "共同日记",
  trip: "足迹",
  first: "第一次",
  milestone: "里程碑",
  anniversary: "纪念日",
  food: "探店",
  watch: "观影",
};

function backTargetForCategory(category: string) {
  switch (category) {
    case "trip":
      return { href: "/places/map", label: "返回足迹地图" };
    case "food":
      return { href: "/places/food", label: "返回探店地图" };
    case "diary":
      return { href: "/daily/diary", label: "返回共同日记" };
    case "watch":
      return { href: "/daily/watch", label: "返回观影记录" };
    case "anniversary":
      return { href: "/time/anniversaries", label: "返回纪念日" };
    case "first":
      return { href: "/time/firsts", label: "返回第一次合集" };
    case "milestone":
      return { href: "/time/milestones", label: "返回重要里程碑" };
    default:
      return { href: "/time/timeline", label: "返回时间轴" };
  }
}

function mediaElement(item: Media, className = "") {
  if (item.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.display_url ?? ""}
        alt={item.caption ?? "回忆照片"}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  if (item.type === "video") {
    return (
      <video
        src={item.display_url ?? ""}
        controls
        preload="metadata"
        className={`h-full w-full bg-black object-contain ${className}`}
      />
    );
  }
  return (
    <div className={`flex h-full w-full items-center bg-[var(--color-surface-soft)] p-5 ${className}`}>
      <audio src={item.display_url ?? ""} controls preload="metadata" className="w-full" />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getMemoryDetail(id);
  return { title: detail?.entry?.title || "回忆详情" };
}

export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getMemoryDetail(id);
  if (!detail?.entry) notFound();
  const { entry, chapter, place, messages } = detail;
  const backTarget = backTargetForCategory(entry.category);
  const visibleMedia = entry.media?.filter((item) => item.display_url) ?? [];
  const pagePath = `/memories/${entry.id}`;
  const followUps = await getEntryFollowUps(entry.id);

  return (
    <main className="page-shell max-w-[960px] py-7">
      <EntryAttentionMarker entryId={entry.id} />
      <Link href={backTarget.href} className="mb-6 inline-flex items-center gap-2 text-[13.5px] text-muted hover:text-[var(--color-accent-strong)]">
        <ArrowLeft size={17} /> {backTarget.label}
      </Link>
      <article>
        <div className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-[var(--color-accent-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-accent-strong)]">{CATEGORY_LABELS[entry.category] ?? entry.category}</span>
            {chapter && <span className="rounded-full bg-[var(--color-control)] px-3.5 py-1.5 text-xs text-muted">{chapter.title}</span>}
          </div>
          <h1 className="font-heading text-[34px] font-bold leading-[1.3] text-text sm:text-[38px]">
            {entry.title || "无题回忆"}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-[13.5px] text-muted">
            <span className="flex items-center gap-2"><CalendarDays size={16} />{formatDate(entry.happened_at, true)}</span>
            {place && <span className="flex items-center gap-2"><MapPin size={16} />{place.name}</span>}
            <span>由 {entry.profiles?.display_name ?? "我们"} 写下</span>
            {entry.updated_by_profile &&
              entry.updated_by_profile.display_name !== entry.profiles?.display_name && (
                <span>{entry.updated_by_profile.display_name} 最后编辑</span>
              )}
          </div>
        </div>

        {visibleMedia.length ? (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-semibold text-text">全部媒体</h2>
              <span className="text-xs text-muted">{visibleMedia.length} 个文件</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleMedia.map((item, index) => (
                <figure
                  key={item.id}
                  className={`surface overflow-hidden rounded-[20px] ${index === 0 ? "sm:col-span-2" : ""}`}
                >
                  <div className={index === 0 ? "h-[18rem] sm:h-[420px]" : "h-[16rem]"}>
                    {mediaElement(item)}
                  </div>
                  {item.caption && (
                    <figcaption className="border-t border-line px-4 py-3 text-xs text-muted">
                      {item.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section className="surface rounded-[24px] p-6 sm:p-[34px]">
          <p className="whitespace-pre-wrap text-[15.5px] leading-[2.05] text-text">
            {entry.body || "这段回忆还没有写下说明。"}
          </p>
          {(entry.mood || entry.rating) && (
            <div className="mt-6 flex flex-wrap gap-8 border-t border-line pt-5">
              {entry.mood && (
                <div>
                  <div className="mb-2 text-xs text-muted">那天的心情</div>
                  <div className="font-medium text-text">{entry.mood}</div>
                </div>
              )}
              {entry.rating && (
                <div>
                  <div className="mb-2 text-xs text-muted">这一天的评分</div>
                  <div className="tracking-[2px] text-[var(--color-amber)]">{"★".repeat(entry.rating)}</div>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="mt-8">
          <EntryFollowUps
            entryId={entry.id}
            pagePath={pagePath}
            pageTitle={entry.title || "无题回忆"}
            initialEvents={followUps}
          />
        </div>

        {messages.length ? (
          <section className="mt-8">
            <div className="rounded-[24px] bg-[var(--color-surface-soft)] p-5 shadow-[inset_0_2px_6px_rgb(0_0_0_/_6%)] sm:p-7">
              <h2 className="mb-6 flex items-center justify-center gap-2 text-center font-heading text-base font-semibold text-text">
                <MessageCircle size={18} /> 当天的聊天记录
              </h2>
              <ChatBubbleThread
                messages={messages}
                selfLabel={process.env.REVIEW_SELF_LABEL || "张张"}
                partnerLabel={process.env.REVIEW_PARTNER_LABEL || "沈沈"}
              />
            </div>
          </section>
        ) : null}

        <div className="mt-8">
          <PageFootprints pagePath={pagePath} title="这段回忆的足迹" />
        </div>
      </article>
    </main>
  );
}
