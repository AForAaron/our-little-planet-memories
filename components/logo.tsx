import Link from "next/link";

export function Logo({ title = "我们的小星球" }: { title?: string | null }) {
  return (
    <Link href="/home" className="flex items-center gap-3">
      <span className="brand-mark" aria-hidden="true">
        <svg className="brand-orbit" viewBox="0 0 24 24" fill="none">
          <circle cx="9.5" cy="12" r="5.5" stroke="#fff6ec" strokeWidth="1.6" />
          <circle cx="14.5" cy="12" r="5.5" stroke="#fff6ec" strokeWidth="1.6" />
        </svg>
      </span>
      <span className="font-heading text-lg font-semibold text-[#43332c]">{title || "我们的小星球"}</span>
    </Link>
  );
}
