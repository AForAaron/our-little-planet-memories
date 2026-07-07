import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TimelineView } from "@/components/timeline-view";
import { getTimelineData } from "@/lib/data/memories";

export const metadata = { title: "恋爱时间轴" };

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ entries, userId, isDemo }, query] = await Promise.all([
    getTimelineData(),
    searchParams,
  ]);
  return (
    <main className="page-shell">
      <Link href="/time" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text">
        <ArrowLeft size={17} /> 关于时间
      </Link>
      <div className="mb-10 max-w-2xl">
        <span className="eyebrow">Our timeline</span>
        <h1 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">恋爱时间轴</h1>
        <p className="mt-4 leading-7 text-muted">新故事在最上面，旧故事也不会走丢。慢慢往下翻，就是我们一路走来的样子。</p>
      </div>
      <TimelineView entries={entries} currentUserId={userId} openNew={query.new === "1"} isDemo={isDemo} />
    </main>
  );
}
