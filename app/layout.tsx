import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "我们的小星球", template: "%s · 我们的小星球" },
  description: "只属于两个人的回忆宇宙",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
