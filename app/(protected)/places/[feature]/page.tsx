import { ArrowLeft, Globe2, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TimelineView } from "@/components/timeline-view";
import { WorldMap } from "@/components/world-map";
import { getEntriesData, getMapPoints } from "@/lib/data/memories";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  return { title: feature === "food" ? "探店地图" : "足迹地图" };
}

async function MapDataPage({ foodOnly = false }: { foodOnly?: boolean }) {
  const [mapData, foodEntries] = await Promise.all([
    getMapPoints(foodOnly),
    foodOnly ? getEntriesData(["food"]) : Promise.resolve(null),
  ]);
  return (
    <main className="page-shell max-w-[1100px] py-7">
      <Link href="/places" className="mb-6 inline-flex items-center gap-2 text-[13.5px] text-muted hover:text-[var(--color-accent-strong)]">
        <ArrowLeft size={17} /> 关于足迹
      </Link>
      <div className="mb-8">
        <span className="eyebrow"><Globe2 size={14} /> {foodOnly ? "Food map" : "Our world"}</span>
        <h1 className="mt-3 font-heading text-[32px] font-semibold text-text">{foodOnly ? "探店地图" : "足迹地图"}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted">
          {foodOnly
            ? "把一起吃过、想再去、值得记住的味道放在同一张地图上。"
            : "每个地点对应一段真实事件；同一旅程会按时间顺序连接。"}
        </p>
      </div>
      <section className="surface mt-8 min-h-96 overflow-hidden rounded-[24px] p-4 sm:p-6">
        <WorldMap
          points={mapData.points}
          enableViewportLoading={mapData.hasMore}
          category={foodOnly ? "food" : undefined}
        />
      </section>
      {mapData.hasMore && (
        <p className="mt-5 text-sm text-muted">
          下方先展示最新一批地点；地图会在拖动或缩放时按当前视野加载更多标记。
        </p>
      )}
      <div className="mt-7 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {mapData.points.map((point) => (
          <Link key={point.id} href={`/memories/${point.id}`} className="surface rounded-[20px] p-5 transition-transform hover:-translate-y-1 hover:shadow-lift">
            <span className="grid size-[42px] place-items-center rounded-[13px] bg-[var(--color-amber-soft)] text-[var(--color-amber)]">
              <MapPin size={20} />
            </span>
            <h2 className="mt-4 font-heading font-semibold text-text">{point.title}</h2>
            <p className="mt-2 text-sm text-muted">{point.placeName} · {formatDate(point.happenedAt)}</p>
            <p className="mt-2 font-mono text-xs text-muted">{point.latitude}, {point.longitude}</p>
          </Link>
        ))}
      </div>
      {foodEntries && (
        <section className="mt-12">
          <div className="mb-8 max-w-2xl">
            <span className="eyebrow">Food memories</span>
            <h2 className="mt-3 font-heading text-[28px] font-semibold text-text">探店记录</h2>
            <p className="mt-3 leading-7 text-muted">
              吃过的味道、给过的评分，以及值得再去一次的地方。
            </p>
          </div>
          <TimelineView
            entries={foodEntries.entries}
            currentUserId={foodEntries.userId}
            isDemo={foodEntries.isDemo}
            defaultCategory="food"
            categories={["food"]}
            nextCursor={foodEntries.nextCursor}
            total={foodEntries.total}
          />
        </section>
      )}
    </main>
  );
}

export default async function PlacesFeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  if (feature === "map") return <MapDataPage />;
  if (feature === "food") return <MapDataPage foodOnly />;
  notFound();
}
