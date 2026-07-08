import { ArrowLeft, Map, MapPin } from "lucide-react";
import Link from "next/link";
import { FeatureCard } from "@/components/feature-card";
import { getHomeData } from "@/lib/data/memories";

export const metadata = { title: "关于足迹" };

export default async function PlacesPage() {
  const { counts } = await getHomeData();
  return (
    <main className="page-shell max-w-[1100px] py-7">
      <Link href="/home" className="mb-6 inline-flex items-center gap-2 text-[13.5px] text-muted hover:text-[var(--color-accent-strong)]">
        <ArrowLeft size={17} /> 回到星球首页
      </Link>
      <div className="mb-10 max-w-2xl">
        <span className="eyebrow">Our world</span>
        <h1 className="mt-3 font-heading text-[32px] font-semibold text-[#43332c]">关于足迹</h1>
        <p className="mt-3 text-[15px] leading-7 text-muted">
          走过的路、吃过的店、停留过的城市，都在这里慢慢变成地图。
        </p>
      </div>
      <div className="grid gap-[18px] lg:grid-cols-2">
        <FeatureCard icon={Map} name="足迹地图" stat={`${counts.trip ?? 0} 段旅程`} href="/places/map" tone="amber" />
        <FeatureCard icon={MapPin} name="探店地图" stat={`${counts.food ?? 0} 次探店`} href="/places/food" tone="amber" />
      </div>
    </main>
  );
}
