import type { LucideIcon } from "lucide-react";
import { ArrowRight, Clock3, Heart, Map as MapIcon } from "lucide-react";
import Link from "next/link";

export function SectionHeading({
  title,
  description,
  href,
  tone = "coral",
  icon: Icon,
}: {
  title: string;
  description: string;
  href?: string;
  tone?: "coral" | "amber" | "pink";
  icon?: LucideIcon;
}) {
  const tones = {
    coral: {
      accent: "var(--color-accent)",
      soft: "var(--color-accent-soft)",
      gradient: "linear-gradient(135deg, #f6b0a0, #ec7c68)",
      border: "#f3cfc4",
      fallback: Clock3,
    },
    amber: {
      accent: "var(--color-amber)",
      soft: "var(--color-amber-soft)",
      gradient: "linear-gradient(135deg, #efc48c, #db9a57)",
      border: "#eed3ac",
      fallback: MapIcon,
    },
    pink: {
      accent: "var(--color-pink)",
      soft: "var(--color-pink-soft)",
      gradient: "linear-gradient(135deg, #f4b9c0, #ec94a3)",
      border: "#f3c9d0",
      fallback: Heart,
    },
  };
  const config = tones[tone];
  const HeadingIcon = Icon ?? config.fallback;
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
      <div className="flex items-center gap-4">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-[15px] text-[var(--color-on-accent)] shadow-[0_12px_24px_-10px_rgb(224_112_94_/_60%)]"
          style={{ background: config.gradient }}
          aria-hidden="true"
        >
          <HeadingIcon size={24} />
        </span>
        <div>
          <h2 className="font-heading text-[23px] font-semibold leading-tight text-[#43332c]">{title}</h2>
          <p className="mt-1 text-[13.5px] text-muted">{description}</p>
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-2 text-[13.5px] font-semibold transition hover:-translate-y-0.5"
          style={{ color: config.accent, background: config.soft, borderColor: config.border }}
        >
          进入模块 <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
