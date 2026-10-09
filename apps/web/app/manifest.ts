import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "맹고",
    short_name: "맹고",
    description: "관심 분야 기술 뉴스를 매일 아침 요약하고 읽어 드려요.",
    categories: ["news", "productivity", "education"],
    start_url: "/today",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    lang: "ko",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
