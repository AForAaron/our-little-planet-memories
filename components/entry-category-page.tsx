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
  const { entries, userId, isDemo } = await getEntriesData(categories);
  return (
    <main className="page-shell">
      <Link href={backHref} className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text">
        <ArrowLeft size={17} /> {backLabel}
      </Link>
      <div className="mb-10 max-w-2xl">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">{title}</h1>
        <p className="mt-4 leading-7 text-muted">{description}</p>
      </div>
      <TimelineView
        entries={entries}
        currentUserId={userId}
        isDemo={isDemo}
        defaultCategory={categories[0]}
      />
    </main>
  );
}
