import { ArrowLeft, Cake, Flag, Infinity, Sparkles, Waypoints } from "lucide-react";
import Link from "next/link";
import { FeatureCard } from "@/components/feature-card";

export const metadata = { title: "关于时间" };

export default function TimePage() {
  return (
    <main className="page-shell">
      <Link href="/home" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text">
        <ArrowLeft size={17} /> 回到星球首页
      </Link>
      <div className="max-w-2xl">
        <span className="eyebrow">Time & memories</span>
        <h1 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">关于时间</h1>
        <p className="mt-4 leading-7 text-muted">时间会往前走，我们把值得记住的部分轻轻留下。</p>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard icon={Waypoints} name="恋爱时间轴" stat="按时间翻阅共同回忆" href="/time/timeline" />
        <FeatureCard icon={Infinity} name="在一起计数" stat="每一天都算数" href="/time/counter" />
        <FeatureCard icon={Cake} name="纪念日" stat="下一次特别日子" href="/time/anniversaries" />
        <FeatureCard icon={Sparkles} name="第一次合集" stat="那些可爱的第一次" href="/time/firsts" />
        <FeatureCard icon={Flag} name="重要里程碑" stat="给故事标上路牌" href="/time/milestones" />
      </div>
    </main>
  );
}
