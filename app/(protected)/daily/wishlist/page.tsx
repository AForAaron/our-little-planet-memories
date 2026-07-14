import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageFootprints } from "@/components/page-footprints";
import { EmojiUsageProvider } from "@/components/emoji-usage-provider";
import { WishlistBoard } from "@/components/wishlist-board";
import { getWishlist } from "@/lib/data/wishlist";

export const metadata = { title: "愿望清单" };

export default async function WishlistPage() {
  const { items, isDemo } = await getWishlist();
  return (
    <main className="page-shell max-w-[1100px] py-7">
      <Link href="/daily" className="mb-6 inline-flex items-center gap-2 text-[13.5px] text-muted hover:text-[var(--color-accent-strong)]">
        <ArrowLeft size={17} /> 关于日常
      </Link>
      <span className="eyebrow"><Sparkles size={14} /> Things we will do</span>
      <h1 className="mt-3 font-heading text-[32px] font-semibold text-text">愿望清单</h1>
      <p className="mb-9 mt-3 max-w-2xl text-[15px] leading-7 text-muted">想去的地方、想做的小事，都先放在这里，等某一天一起划掉。</p>
      <EmojiUsageProvider isDemo={isDemo}>
        <WishlistBoard items={items} isDemo={isDemo} />
      </EmojiUsageProvider>
      <div className="mt-8">
        <PageFootprints pagePath="/daily/wishlist" title="愿望清单的足迹" />
      </div>
    </main>
  );
}
