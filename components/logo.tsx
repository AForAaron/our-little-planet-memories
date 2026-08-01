import Link from "next/link";
import { BrandIcon } from "./brand-icon";

export function Logo({ title = "我们的小星球" }: { title?: string | null }) {
  return (
    <Link href="/home" className="flex min-w-0 items-center gap-2 sm:gap-3">
      <span className="brand-mark shrink-0" aria-hidden="true">
        <BrandIcon className="brand-orbit" variant="logo" />
      </span>
      <span className="min-w-0 truncate font-heading text-base font-semibold text-text sm:text-lg">
        {title || "我们的小星球"}
      </span>
    </Link>
  );
}
