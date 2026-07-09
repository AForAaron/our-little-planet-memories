import { ArrowLeft, Footprints, MessageCircleHeart } from "lucide-react";
import Link from "next/link";
import { FootprintEventList } from "@/components/footprint-event-list";
import { getFootprints } from "@/lib/data/footprints";

export const dynamic = "force-dynamic";
export const metadata = { title: "足迹流" };

export default async function FootprintsPage() {
  const events = await getFootprints({ failSoft: true, limit: 60 });

  return (
    <main className="page-shell max-w-[980px] py-7">
      <Link href="/home" className="mb-6 inline-flex items-center gap-2 text-[13.5px] text-muted hover:text-[var(--color-accent-strong)]">
        <ArrowLeft size={17} /> 回到星球首页
      </Link>

      <section className="footprints-hero">
        <span className="eyebrow"><Footprints size={14} /> Footprint stream</span>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1>足迹流</h1>
            <p>
              这里收集你们在小星球上留下的小纸条、反应和同一刻的停留。
            </p>
          </div>
          <div className="footprints-hero-stat">
            <MessageCircleHeart size={20} />
            <b>{events.length}</b>
            <span>条最近足迹</span>
          </div>
        </div>
      </section>

      <section className="surface mt-8 rounded-[24px] p-4 sm:p-6">
        <FootprintEventList
          events={events}
          emptyText="足迹流还很安静。打开右下角小窗，给某一页留第一句话。"
        />
      </section>
    </main>
  );
}
