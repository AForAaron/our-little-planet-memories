import Link from "next/link";
import { FootprintEventList } from "@/components/footprint-event-list";
import { getFootprints } from "@/lib/data/footprints";

export async function PageFootprints({
  pagePath,
  title = "这里的足迹",
}: {
  pagePath: string;
  title?: string;
}) {
  const events = await getFootprints({ pagePath, limit: 6 });

  return (
    <section className="footprint-panel">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2>{title}</h2>
          <p>留在这一页的小纸条和共同停留。</p>
        </div>
        <Link href="/footprints" className="text-xs font-semibold text-[var(--color-accent-strong)] hover:text-accent">
          查看全部
        </Link>
      </div>
      <FootprintEventList
        events={events}
        compact
        emptyText="这里还没有足迹，等一句刚好想留下的话。"
      />
    </section>
  );
}
