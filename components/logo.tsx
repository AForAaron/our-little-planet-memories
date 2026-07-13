import Link from "next/link";
import { BrandIcon } from "./brand-icon";

export function Logo({ title = "我们的小星球" }: { title?: string | null }) {
  return (
    <Link href="/home" className="flex items-center gap-3">
      <span className="brand-mark" aria-hidden="true">
        <BrandIcon className="brand-orbit" variant="logo" />
      </span>
      <span className="font-heading text-lg font-semibold text-text">{title || "我们的小星球"}</span>
    </Link>
  );
}
