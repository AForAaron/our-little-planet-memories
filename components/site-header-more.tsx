"use client";

import { Footprints, LogOut, MoreHorizontal, Settings2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import { signOut } from "@/app/login/actions";

export function SiteHeaderMore({ isDemo = false }: { isDemo?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="site-header-more" ref={rootRef}>
      <button
        type="button"
        className="button-secondary size-11 !p-0"
        aria-label={open ? "关闭更多操作" : "更多操作"}
        aria-expanded={open}
        aria-controls={menuId}
        title="更多"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={18} /> : <MoreHorizontal size={18} />}
      </button>
      {open ? (
        <div id={menuId} className="site-header-more-menu" role="menu" aria-label="更多操作">
          <div className="site-header-more-row" role="none">
            <ThemeToggle />
            <span>切换主题</span>
          </div>
          {!isDemo ? (
            <div className="site-header-more-row" role="none">
              <NotificationBell />
              <span>通知</span>
            </div>
          ) : null}
          <Link
            href="/footprints"
            className="site-header-more-link"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="button-secondary size-11 !p-0" aria-hidden="true">
              <Footprints size={18} />
            </span>
            <span>足迹流</span>
          </Link>
          <Link
            href="/setup"
            className="site-header-more-link"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className="button-secondary size-11 !p-0" aria-hidden="true">
              <Settings2 size={18} />
            </span>
            <span>网站设置</span>
          </Link>
          {!isDemo ? (
            <form action={signOut} className="site-header-more-form" role="none">
              <button type="submit" className="site-header-more-link" role="menuitem">
                <span className="button-secondary size-11 !p-0" aria-hidden="true">
                  <LogOut size={18} />
                </span>
                <span>退出登录</span>
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
