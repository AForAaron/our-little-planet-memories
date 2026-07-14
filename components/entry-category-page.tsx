import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { EntryCategory } from "@/lib/database.types";
import { getEntriesData } from "@/lib/data/memories";
import { TimelineView } from "./timeline-view";

export async function EntryCategoryPage({
  title,
  description,
  eyebrow,
  categories,
  backHref,
  backLabel = "返回",
}: {
  title: string;
  description: string;
  eyebrow: string;
  categories: EntryCategory[];
  backHref: string;
  backLabel?: string;
}) {
  const { entries, userId, isDemo, nextCursor, total } = await getEntriesData(categories);
  return (
    <main className="page-shell max-w-[1100px] py-7">
      <Link href={backHref} className="mb-6 inline-flex items-center gap-2 text-[13.5px] text-muted hover:text-[var(--color-accent-strong)]">
        <ArrowLeft size={17} /> {backLabel}
      </Link>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
        <span className="eyebrow">{eyebrow}</span>
          <h1 className="mt-3 font-heading text-[32px] font-semibold leading-tight text-text">{title}</h1>
          <p className="mt-3 text-[15px] leading-7 text-muted">{description}</p>
        </div>
      </div>
      <TimelineView
        entries={entries}
        currentUserId={userId}
        isDemo={isDemo}
        defaultCategory={categories[0]}
        categories={categories}
        nextCursor={nextCursor}
        total={total}
      />
    </main>
  );
}
