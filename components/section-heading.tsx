import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function SectionHeading({
  title,
  description,
  href,
  tone = "coral",
}: {
  title: string;
  description: string;
  href?: string;
  tone?: "coral" | "amber" | "pink";
}) {
  const colors = {
    coral: "var(--color-accent)",
    amber: "var(--color-amber)",
    pink: "var(--color-pink)",
  };
  return (
    <div className="mb-5 border-b border-line pb-4">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <span className="mb-1 size-3 rounded-[var(--radius-xs)]" style={{ background: colors[tone] }} />
          <h2 className="font-heading text-xl font-bold">{title}</h2>
          <p className="pb-0.5 text-sm text-muted">{description}</p>
        </div>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-text">
            进入模块 <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
