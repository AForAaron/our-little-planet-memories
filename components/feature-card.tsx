import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function FeatureCard({
  icon: Icon,
  name,
  stat,
  href,
  tone = "coral",
}: {
  icon: LucideIcon;
  name: string;
  stat: string;
  href: string;
  tone?: "coral" | "amber" | "pink";
}) {
  const tones = {
    coral: { accent: "var(--color-accent)", soft: "var(--color-accent-soft)" },
    amber: { accent: "var(--color-amber)", soft: "var(--color-amber-soft)" },
    pink: { accent: "var(--color-pink)", soft: "var(--color-pink-soft)" },
  };
  return (
    <Link
      href={href}
      className="feature-card surface group"
      style={{
        "--section-accent": tones[tone].accent,
        "--section-soft": tones[tone].soft,
      } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <span className="feature-icon"><Icon size={20} /></span>
        <ArrowUpRight size={17} className="text-muted opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--section-accent)]" />
      </div>
      <div>
        <h3 className="text-[15.5px] font-semibold text-[#43332c]">{name}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{stat}</p>
      </div>
    </Link>
  );
}
