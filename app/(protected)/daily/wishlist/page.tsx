import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { WishlistBoard } from "@/components/wishlist-board";
import { getWishlist } from "@/lib/data/wishlist";

export const metadata = { title: "愿望清单" };

export default async function WishlistPage() {
  const { items, isDemo } = await getWishlist();
  return (
    <main className="page-shell">
      <Link href="/daily" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text">
        <ArrowLeft size={17} /> 关于日常
      </Link>
      <span className="eyebrow"><Sparkles size={14} /> Things we will do</span>
      <h1 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">愿望清单</h1>
      <p className="mb-9 mt-4 max-w-2xl leading-7 text-muted">想去的地方、想做的小事，都先放在这里，等某一天一起划掉。</p>
      <WishlistBoard items={items} isDemo={isDemo} />
    </main>
  );
}
