import { Heart } from "lucide-react";
import Link from "next/link";

export function Logo({ title = "我们的小星球" }: { title?: string | null }) {
  return (
    <Link href="/home" className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-soft bg-[var(--color-accent-soft)] text-accent shadow-theme">
        <Heart size={23} fill="currentColor" />
      </span>
      <span className="font-heading text-xl font-bold tracking-tight">{title || "我们的小星球"}</span>
    </Link>
  );
}
