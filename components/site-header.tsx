import { LogOut, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { signOut } from "@/app/login/actions";

export function SiteHeader({ isDemo = false, title }: { isDemo?: boolean; title?: string | null }) {
  return (
    <header className="site-header">
      <div className="page-shell flex items-center justify-between gap-4 py-[15px]">
        <Logo title={title} />
        <nav className="flex items-center gap-2" aria-label="主要操作">
          {isDemo && (
            <span className="hidden rounded-full border border-[#eed3ac] bg-[var(--color-amber-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-amber)] sm:inline">
              预览模式
            </span>
          )}
          <ThemeToggle />
          <Link href="/setup" className="button-secondary size-10 !p-0" aria-label="网站设置" title="网站设置">
            <Settings2 size={18} />
          </Link>
          <Link href="/time/timeline?new=1" className="button-primary h-10 px-4">
            <Plus size={16} />
            <span className="hidden sm:inline">添加回忆</span>
          </Link>
          {!isDemo && (
            <form action={signOut}>
              <button className="button-secondary size-10 !p-0" aria-label="退出登录" title="退出登录">
                <LogOut size={18} />
              </button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
