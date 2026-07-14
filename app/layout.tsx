import type { Metadata } from "next";
import "./theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "我们的小星球", template: "%s · 我们的小星球" },
  description: "只属于两个人的回忆宇宙",
  icons: {
    icon: [
      { url: "/favicon.ico?v=donut-planet-1", sizes: "any" },
      { url: "/icon.png?v=donut-planet-1", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png?v=donut-planet-1", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest?v=donut-planet-1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
