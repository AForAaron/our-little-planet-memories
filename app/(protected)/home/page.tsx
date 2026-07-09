import {
  Cake, Clapperboard, Infinity, ListChecks, Map, MapPin,
  NotebookPen, Sparkles, Waypoints, Clock3,
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
    <main className="page-shell py-10">
      <section className="hero cosmos-panel relative mb-14 overflow-hidden rounded-theme">
        <span className="tiny-star left-[30%] top-[22%]" />
        <span className="tiny-star left-[44%] top-[60%] [animation-delay:1s]" />
        <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.25fr_.9fr] lg:p-12">
          <div className="flex min-h-[20rem] flex-col justify-center text-[var(--color-on-accent)]">
            <span className="mb-6 flex w-fit items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-on-accent)_38%,transparent)] bg-[color-mix(in_srgb,var(--color-on-accent)_18%,transparent)] px-3.5 py-2 text-xs tracking-[.16em]">
              <span className="size-1.5 rounded-full bg-[var(--color-on-accent)]" /> 从 {since} 一起看星星
            </span>
            <h1 className="font-heading text-[30px] font-semibold leading-[1.4] drop-shadow-sm">
              张张 &amp; 沈沈
              <br />
              在同一颗小星球上
            </h1>
            <div className="mt-8 flex flex-wrap items-end gap-8">
              <div>
                <div className="font-heading text-[62px] font-bold leading-none">{days || "—"}</div>
                <div className="mt-2 text-[13.5px] tracking-[.04em] opacity-90">在一起的第 {days || "—"} 天</div>
              </div>
              <div className="hidden h-14 w-px bg-[color-mix(in_srgb,var(--color-on-accent)_38%,transparent)] sm:block" />
              <div className="pb-1">
                <div className="text-[22px] font-semibold">{milestone.remaining} 天</div>
                <div className="mt-1.5 text-[13px] opacity-90">距离第 {milestone.next} 天</div>
              </div>
            </div>
            <div className="mt-8 max-w-[420px]">
              <div className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-on-accent)_22%,transparent)]">
                <div className="h-full rounded-full bg-[var(--color-on-accent)]" style={{ width: `${milestone.progress}%` }} />
              </div>
              <p className="mt-2 flex justify-between text-[11.5px] opacity-85">
                <span>第 {milestone.next - 100} 天</span>
                <span>第 {milestone.next} 天</span>
              </p>
            </div>
          </div>

          <Link href="/time/timeline" className="relative flex min-h-64 flex-col rounded-[1.5rem] bg-[var(--color-surface)] p-[18px] text-text shadow-lift transition-transform hover:-translate-y-1">
            {latest?.media?.[0]?.display_url ? (
              // R2 uses a short-lived signed private URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={latest.media[0].display_url} alt="" className="h-[168px] w-full rounded-2xl object-cover" />
            ) : (
              <div className="photo-placeholder flex h-[168px] items-center justify-center rounded-2xl">
                <span className="font-mono text-[11px] uppercase tracking-[.14em] text-muted">封面照片 · 16:10</span>
              </div>
            )}
            <div className="px-2 pb-2 pt-4">
              <div className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[.04em] text-[var(--color-accent-strong)]">
                最近的一段回忆 {latest && `· ${formatDate(latest.happened_at)}`}
              </div>
              <h3 className="mt-2 font-heading text-lg font-semibold text-text">{latest?.title ?? "还没有回忆，写下第一条吧"}</h3>
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-6 text-muted">{latest?.body ?? "两个人的故事，正等着从这里开始。"}</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="mb-[52px]">
        <SectionHeading title="关于时间" description="把每一个值得记住的日子留下来。" href="/time" icon={Clock3} />
        <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={Waypoints} name="恋爱时间轴" stat={`${count} 条共同回忆`} href="/time/timeline" />
          <FeatureCard icon={Infinity} name="在一起计数" stat={`第 ${days || "—"} 天`} href="/time/counter" />
          <FeatureCard icon={Cake} name="纪念日" stat={`${counts.anniversary ?? 0} 个特别日期`} href="/time/anniversaries" />
          <FeatureCard icon={Sparkles} name="第一次合集" stat={`${counts.first ?? 0} 个第一次`} href="/time/firsts" />
        </div>
      </section>

      <section className="mb-[52px]">
        <SectionHeading title="关于足迹" description="走过的路，都是我们的地图。" href="/places" tone="amber" icon={Map} />
        <div className="grid gap-[18px] lg:grid-cols-2">
          <FeatureCard icon={Map} name="足迹地图" stat={`${counts.trip ?? 0} 段旅程，每个地点都有一段真实的事。`} href="/places/map" tone="amber" />
          <FeatureCard icon={MapPin} name="探店地图" stat={`${counts.food ?? 0} 次探店，一起吃过、想再去的味道。`} href="/places/food" tone="amber" />
        </div>
      </section>

      <section>
        <SectionHeading title="关于日常" description="平淡的每一天，也想和你一起记录。" href="/daily" tone="pink" />
        <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon={NotebookPen} name="共同日记" stat={`${counts.diary ?? 0} 篇日记，平凡日子也值得写下。`} href="/daily/diary" tone="pink" />
          <FeatureCard icon={ListChecks} name="愿望清单" stat="等某天一起划掉它。" href="/daily/wishlist" tone="pink" />
          <FeatureCard icon={Clapperboard} name="观影记录" stat={`${counts.watch ?? 0} 部作品，散场后也留下感受。`} href="/daily/watch" tone="pink" />
        </div>
      </section>
    </main>
  );
}
