import { ArrowLeft, Footprints, MessageCircleHeart } from "lucide-react";
import Link from "next/link";
import { ActivityStreamList } from "@/components/activity-stream-list";
import { PendingEntryInbox } from "@/components/pending-entry-inbox";
import { getActivityStream, getPendingEntryAttention } from "@/lib/data/activity-stream";

export const dynamic = "force-dynamic";
export const metadata = { title: "足迹流" };

export default async function FootprintsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const [stream, inbox] = await Promise.all([
    getActivityStream({ filter, limit: 24 }),
    getPendingEntryAttention(),
  ]);

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
              这里收集悄悄话、互动、追评，还有每一次被重新写下的回忆。
            </p>
          </div>
          <div className="footprints-hero-stat">
            <MessageCircleHeart size={20} />
            <b>{stream.items.length}</b>
            <span>条最近动态</span>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <PendingEntryInbox items={inbox.items} />
      </div>

      <section id="stream" className="activity-stream-panel mt-8 scroll-mt-6">
        <div className="activity-stream-head">
          <div>
            <span className="eyebrow"><Footprints size={14} /> All activity</span>
            <h2>所有足迹</h2>
            <p>每一条内容都有来处，也都有它该停留的位置。</p>
          </div>
          <MessageCircleHeart size={21} />
        </div>
        <ActivityStreamList
          key={stream.filter}
          initialItems={stream.items}
          initialNextCursor={stream.nextCursor}
          filter={stream.filter}
        />
      </section>
    </main>
  );
}
