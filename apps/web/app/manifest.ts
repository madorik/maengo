import type { MetadataRoute } from "next";
import { BASE_PATH, withBase } from "@/lib/base-path";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: withBase("/"),
    name: "맹고",
    short_name: "맹고",
    description: "금리·환율·주식, 오늘 소식이 내게 미칠 영향까지 짚어 출근길·퇴근길에 읽어 드려요.",
    categories: ["news", "productivity", "education"],
    start_url: withBase("/today"),
    scope: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    lang: "ko",
    icons: [
      { src: withBase("/icon.svg"), sizes: "any", type: "image/svg+xml" },
      { src: withBase("/apple-icon.png"), sizes: "180x180", type: "image/png" },
    ],
  };
}
