import { ArrowLeft, CalendarHeart, Infinity } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryCategoryPage } from "@/components/entry-category-page";
import { getEntriesData } from "@/lib/data/memories";
import { getSiteSettings } from "@/lib/data/settings";
import { daysTogether, nextMilestone } from "@/lib/utils";

function nextAnnualOccurrence(iso: string) {
  const source = new Date(iso);
  const now = new Date();
  let next = new Date(now.getFullYear(), source.getMonth(), source.getDate());
  if (next.getTime() < now.setHours(0, 0, 0, 0)) {
    next = new Date(now.getFullYear() + 1, source.getMonth(), source.getDate());
  }
  return {
    date: next,
    days: Math.ceil((next.getTime() - Date.now()) / 86_400_000),
  };
}

async function CounterPage() {
  const { relationship } = await getSiteSettings();
  const days = daysTogether(relationship.together_since);
  const milestone = nextMilestone(days);
  return (
    <main className="page-shell max-w-[1100px] py-7">
      <Link href="/time" className="mb-6 inline-flex items-center gap-2 text-[13.5px] text-muted hover:text-[var(--color-accent-strong)]">
        <ArrowLeft size={17} /> 关于时间
      </Link>
      <section className="hero cosmos-panel relative mx-auto max-w-4xl overflow-hidden rounded-theme p-8 text-center sm:p-14">
        <span className="tiny-star left-[22%] top-[24%]" />
        <span className="tiny-star bottom-[28%] right-[24%] [animation-delay:1s]" />
        <div className="relative">
        <Infinity className="mx-auto" size={38} />
        <p className="mt-6 text-sm font-semibold opacity-85">从 {relationship.together_since ?? "尚未设置"} 开始</p>
        <h1 className="mt-4 font-heading text-5xl font-bold sm:text-7xl">
          第 {days || "—"} 天
        </h1>
        <p className="mt-5 opacity-85">
          距离 {milestone.next} 天里程碑还有 {milestone.remaining} 天
        </p>
        <div className="mx-auto mt-8 max-w-md">
          <div className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-on-accent)_22%,transparent)]">
            <div className="h-full rounded-full bg-[var(--color-on-accent)]" style={{ width: `${milestone.progress}%` }} />
          </div>
        </div>
        </div>
      </section>
    </main>
  );
}

async function AnniversariesPage() {
  const data = await getEntriesData(["anniversary"]);
  const next = data.entries
    .map((entry) => ({ entry, ...nextAnnualOccurrence(entry.happened_at) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  return (
    <>
      {next && (
        <div className="page-shell max-w-[1100px] pb-0 pt-7">
          <div className="surface flex items-center gap-4 rounded-[22px] p-5">
            <span className="grid size-12 place-items-center rounded-[15px] bg-[var(--color-accent-soft)] text-accent">
              <CalendarHeart />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted">下一个纪念日</p>
              <p className="font-heading text-lg font-semibold text-text">{next.entry.title} · 还有 {next.days} 天</p>
            </div>
          </div>
        </div>
      )}
      <EntryCategoryPage
        title="纪念日"
        description="每一年都会重新走到我们珍藏的日期。"
        eyebrow="Anniversaries"
        categories={["anniversary"]}
        backHref="/time"
        backLabel="关于时间"
      />
    </>
  );
}

export default async function TimeFeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  if (feature === "counter") return <CounterPage />;
  if (feature === "anniversaries") return <AnniversariesPage />;
  if (feature === "firsts") {
    return <EntryCategoryPage title="第一次合集" description="第一次见面、第一次旅行，以及后来所有值得记住的第一次。" eyebrow="Our firsts" categories={["first"]} backHref="/time" backLabel="关于时间" />;
  }
  if (feature === "milestones") {
    return <EntryCategoryPage title="重要里程碑" description="把关系里那些真正改变了什么的节点留下来。" eyebrow="Milestones" categories={["milestone"]} backHref="/time" backLabel="关于时间" />;
  }
  notFound();
}
