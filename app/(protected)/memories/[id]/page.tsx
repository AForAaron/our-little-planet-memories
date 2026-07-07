import { ArrowLeft, CalendarDays, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatBubbleThread } from "@/components/chat-bubble-thread";
import { getMemoryDetail } from "@/lib/data/memories";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

  return (
    <main className="page-shell">
      <Link href={backTarget.href} className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text">
        <ArrowLeft size={17} /> {backTarget.label}
      </Link>
      <article className="mx-auto max-w-4xl">
        <div className="mb-8">
          <span className="eyebrow">{entry.category}</span>
          <h1 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">
            {entry.title || "无题回忆"}
          </h1>
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted">
            <span className="flex items-center gap-2"><CalendarDays size={16} />{formatDate(entry.happened_at, true)}</span>
            {place && <span className="flex items-center gap-2"><MapPin size={16} />{place.name}</span>}
            {chapter && <span>{chapter.title}</span>}
            <span>由 {entry.profiles?.display_name ?? "我们"} 写下</span>
            {entry.updated_by_profile &&
              entry.updated_by_profile.display_name !== entry.profiles?.display_name && (
                <span>{entry.updated_by_profile.display_name} 最后编辑</span>
              )}
          </div>
        </div>

        {entry.media?.length ? (
          <div className="mb-8 grid gap-3 sm:grid-cols-2">
            {entry.media.map((item) =>
              item.display_url ? (
                item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={item.id} src={item.display_url} alt={item.caption ?? ""} className="surface h-72 w-full object-cover" />
                ) : item.type === "video" ? (
                  <video key={item.id} src={item.display_url} controls className="surface h-72 w-full bg-black object-contain" />
                ) : (
                  <div key={item.id} className="surface flex items-center p-6">
                    <audio src={item.display_url} controls className="w-full" />
                  </div>
                )
              ) : null,
            )}
          </div>
        ) : null}

        <section className="surface p-6 sm:p-9">
          <p className="whitespace-pre-wrap leading-8 text-muted">
            {entry.body || "这段回忆还没有写下说明。"}
          </p>
          {entry.mood && <p className="mt-6 text-sm text-accent">当时的心情：{entry.mood}</p>}
          {entry.rating && <p className="mt-2 text-sm text-accent">评分：{"★".repeat(entry.rating)}</p>}
        </section>

        {messages.length ? (
          <section className="mt-8">
            <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
              <MessageCircle size={21} /> 相关原文
            </h2>
            <div className="surface mt-5 p-4 sm:p-6">
              <ChatBubbleThread
                messages={messages}
                selfLabel={process.env.REVIEW_SELF_LABEL || "张张"}
                partnerLabel={process.env.REVIEW_PARTNER_LABEL || "沈沈"}
              />
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}
