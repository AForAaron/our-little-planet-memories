import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "我们的小星球",
    short_name: "小星球",
    description: "只属于两个人的回忆宇宙",
    display: "standalone",
    background_color: "#f6ffea",
    theme_color: "#fa855a",
    icons: [
      {
        src: "/brand/donut-planet-192.png?v=donut-planet-1",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/donut-planet-512.png?v=donut-planet-1",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
