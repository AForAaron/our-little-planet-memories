"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState("warm");

  useEffect(() => {
    const saved = localStorage.getItem("planet-theme") ?? "warm";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  function toggle() {
    const next = theme === "warm" ? "starlight" : "warm";
    setTheme(next);
    localStorage.setItem("planet-theme", next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <button className="button-secondary size-11 !p-0" onClick={toggle} aria-label="切换主题" title="切换主题">
      {theme === "warm" ? <MoonStar size={18} /> : <SunMedium size={18} />}
    </button>
  );
}
