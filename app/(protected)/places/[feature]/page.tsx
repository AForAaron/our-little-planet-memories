import { Globe2, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryCategoryPage } from "@/components/entry-category-page";
import { WorldMap } from "@/components/world-map";
import { getMapPoints } from "@/lib/data/memories";
import { formatDate } from "@/lib/utils";

async function MapDataPage({ foodOnly = false }: { foodOnly?: boolean }) {
  const points = await getMapPoints(foodOnly);
  return (
    <main className="page-shell">
      <span className="eyebrow"><Globe2 size={14} /> {foodOnly ? "Food map" : "Our world"}</span>
      <h1 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">{foodOnly ? "探店地图" : "足迹地图"}</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">
        {foodOnly
          ? "把一起吃过、想再去、值得记住的味道放在同一张地图上。"
          : "每个地点对应一段真实事件；同一旅程会按时间顺序连接。"}
      </p>
      <section className="surface mt-8 min-h-96 overflow-hidden p-6">
        <WorldMap points={points} />
      </section>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {points.map((point) => (
          <Link key={point.id} href={`/memories/${point.id}`} className="surface p-5 transition-transform hover:-translate-y-1">
            <MapPin className="text-accent" size={20} />
            <h2 className="mt-3 font-heading font-bold">{point.title}</h2>
            <p className="mt-2 text-sm text-muted">{point.placeName} · {formatDate(point.happenedAt)}</p>
            <p className="mt-2 text-xs text-muted">{point.latitude}, {point.longitude}</p>
          </Link>
        ))}
      </div>
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
  if (feature === "food") {
    return (
      <>
        <MapDataPage foodOnly />
        <div className="mt-10">
          <EntryCategoryPage title="探店记录" description="吃过的味道、给过的评分，以及值得再去一次的地方。" eyebrow="Food memories" categories={["food"]} backHref="/home" />
        </div>
      </>
    );
  }
  notFound();
}
