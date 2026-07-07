import {
  Cake, Clapperboard, Infinity, ListChecks, Map, MapPin,
  NotebookPen, Sparkle, Sparkles, Waypoints, Flag, Clock3,
} from "lucide-react";
import Link from "next/link";
import { FeatureCard } from "@/components/feature-card";
import { SectionHeading } from "@/components/section-heading";
import { getHomeData } from "@/lib/data/memories";
import { daysTogether, formatDate, nextMilestone } from "@/lib/utils";

export default async function HomePage() {
  const { relationship, latest, count, counts } = await getHomeData();
  const days = daysTogether(relationship.together_since);
  const milestone = nextMilestone(days);
  const since = relationship.together_since ? relationship.together_since.replaceAll("-", ".") : "还未设定";

  return (
    <main className="page-shell">
      <section className="hero grid gap-7 rounded-theme p-6 sm:p-9 lg:grid-cols-[1.35fr_.85fr]">
        <div className="flex min-h-64 flex-col justify-center">
          <span className="mb-5 flex w-fit items-center gap-2 rounded-full bg-[var(--color-on-accent)]/15 px-3 py-1.5 text-xs">
            <Sparkle size={14} /> 从 {since} 一起看星星
          </span>
          <p className="font-medium opacity-90">在一起</p>
          <div className="mt-1 flex items-baseline gap-3 font-heading">
            <strong className="text-6xl leading-none sm:text-8xl">{days || "—"}</strong>
            <span className="text-2xl font-semibold">天</span>
          </div>
          <div className="mt-7 max-w-md">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-on-accent)]/25">
              <div className="h-full rounded-full bg-[var(--color-on-accent)]" style={{ width: `${milestone.progress}%` }} />
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm opacity-90">
              <Flag size={15} /> 距离 <b>{milestone.next}</b> 天里程碑，还有 <b>{milestone.remaining}</b> 天
            </p>
          </div>
        </div>

        <Link href="/time/timeline" className="flex min-h-64 flex-col rounded-soft bg-surface p-5 text-text shadow-theme transition-transform hover:-translate-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-bold text-accent"><Clock3 size={15} />最近一条回忆</span>
            {latest && <span className="text-muted">{formatDate(latest.happened_at)}</span>}
          </div>
          {latest?.media?.[0]?.display_url ? (
            // R2 uses a short-lived signed private URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={latest.media[0].display_url} alt="" className="mt-4 h-32 w-full rounded-[var(--radius-xs)] object-cover" />
          ) : (
            <div className="photo-placeholder mt-4 flex h-32 items-end rounded-[var(--radius-xs)] p-3">
              <span className="rounded-[var(--radius-xs)] bg-surface/75 px-2 py-1 text-[.68rem] text-accent">回忆 · memory</span>
            </div>
          )}
          <h3 className="mt-4 font-heading font-bold">{latest?.title ?? "还没有回忆，写下第一条吧"}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{latest?.body ?? "两个人的故事，正等着从这里开始。"}</p>
        </Link>
      </section>

      <section className="mt-11">
        <SectionHeading title="关于时间" description="把每一个值得记住的日子留下来" href="/time" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={Waypoints} name="恋爱时间轴" stat={`${count} 条共同回忆`} href="/time/timeline" />
          <FeatureCard icon={Infinity} name="在一起计数" stat={`第 ${days || "—"} 天`} href="/time/counter" />
          <FeatureCard icon={Cake} name="纪念日" stat={`${counts.anniversary ?? 0} 个特别日期`} href="/time/anniversaries" />
          <FeatureCard icon={Sparkles} name="第一次合集" stat={`${counts.first ?? 0} 个第一次`} href="/time/firsts" />
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading title="关于足迹" description="走过的路，都是我们的地图" href="/places" tone="amber" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={Map} name="足迹地图" stat={`${counts.trip ?? 0} 段旅程`} href="/places/map" tone="amber" />
          <FeatureCard icon={MapPin} name="探店地图" stat={`${counts.food ?? 0} 次探店`} href="/places/food" tone="amber" />
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading title="关于日常" description="平淡的每一天，也想和你一起记录" href="/daily" tone="pink" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={NotebookPen} name="共同日记" stat={`${counts.diary ?? 0} 篇日记`} href="/daily/diary" tone="pink" />
          <FeatureCard icon={ListChecks} name="愿望清单" stat="一起完成的小目标" href="/daily/wishlist" tone="pink" />
          <FeatureCard icon={Clapperboard} name="观影记录" stat={`${counts.watch ?? 0} 部作品`} href="/daily/watch" tone="pink" />
        </div>
      </section>
    </main>
  );
}
