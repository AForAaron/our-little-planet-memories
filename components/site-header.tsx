import { Plus } from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";
import { NotificationBell } from "./notification-bell";
import { SiteHeaderMore } from "./site-header-more";
import { ThemeToggle } from "./theme-toggle";
import { Footprints, LogOut, Settings2 } from "lucide-react";
import { signOut } from "@/app/login/actions";

export function SiteHeader({ isDemo = false, title }: { isDemo?: boolean; title?: string | null }) {
  return (
    <header className="site-header">
      <div className="page-shell flex items-center justify-between gap-3 py-[15px] sm:gap-4">
        <Logo title={title} />
        <nav className="flex shrink-0 items-center gap-2" aria-label="主要操作">
          {isDemo && (
            <span className="hidden rounded-full border border-line bg-[var(--color-amber-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-amber)] sm:inline">
              预览模式
            </span>
          )}
          <div className="site-header-desktop-actions">
            <ThemeToggle />
            {!isDemo && <NotificationBell />}
            <Link href="/footprints" className="button-secondary size-11 !p-0" aria-label="足迹流" title="足迹流">
              <Footprints size={18} />
            </Link>
            <Link href="/setup" className="button-secondary size-11 !p-0" aria-label="网站设置" title="网站设置">
              <Settings2 size={18} />
            </Link>
          </div>
          <Link href="/time/timeline?new=1" className="button-primary h-11 min-w-11 px-3 sm:px-4">
            <Plus size={16} />
            <span className="hidden sm:inline">添加回忆</span>
          </Link>
          <div className="site-header-desktop-actions">
            {!isDemo && (
              <form action={signOut}>
                <button className="button-secondary size-11 !p-0" aria-label="退出登录" title="退出登录">
                  <LogOut size={18} />
                </button>
              </form>
            )}
          </div>
          <div className="site-header-phone-actions">
            <SiteHeaderMore isDemo={isDemo} />
          </div>
        </nav>
      </div>
    </header>
  );
}
