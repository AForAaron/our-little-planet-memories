import { Heart } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="flex items-center justify-center gap-2 py-12 text-center text-xs text-muted">
      <Heart size={14} className="text-accent" fill="currentColor" />
      我们的小星球 · 只属于两个人的宇宙
    </footer>
  );
}
