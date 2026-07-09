import { ArrowLeft, Clapperboard, Footprints, ListChecks, NotebookPen } from "lucide-react";
import Link from "next/link";
import { FeatureCard } from "@/components/feature-card";
import { getHomeData } from "@/lib/data/memories";

export const metadata = { title: "关于日常" };

export default async function DailyPage() {
  const { counts } = await getHomeData();
  return (
    <main className="page-shell max-w-[1100px] py-7">
      <Link href="/home" className="mb-6 inline-flex items-center gap-2 text-[13.5px] text-muted hover:text-[var(--color-accent-strong)]">
        <ArrowLeft size={17} /> 回到星球首页
      </Link>
      <div className="mb-10 max-w-2xl">
        <span className="eyebrow">Daily life</span>
        <h1 className="mt-3 font-heading text-[32px] font-semibold text-text">关于日常</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">
          平淡的小事也有自己的光：日记、愿望、电影，都放在这里。
        </p>
      </div>
      <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard icon={NotebookPen} name="共同日记" stat={`${counts.diary ?? 0} 篇日记`} href="/daily/diary" tone="pink" />
        <FeatureCard icon={ListChecks} name="愿望清单" stat="一起完成的小目标" href="/daily/wishlist" tone="pink" />
        <FeatureCard icon={Clapperboard} name="观影记录" stat={`${counts.watch ?? 0} 部作品`} href="/daily/watch" tone="pink" />
        <FeatureCard icon={Footprints} name="足迹流" stat="最近留下的小纸条和同屏停留" href="/footprints" tone="pink" />
      </div>
    </main>
  );
}
