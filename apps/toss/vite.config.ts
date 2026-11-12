import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 맹고 웹(apps/web)의 화면 컴포넌트를 그대로 가져다 쓴다(둘러보기 /try와 같은 화면, components/try/GuestTour.tsx).
// next/link만 평범한 <a>로 바꿔 끼운다. react는 이 앱 것 하나만 쓴다(웹 쪽 react와 둘이 되면 훅이 깨진다)
const web = path.resolve(__dirname, "../web");
// @maengo/core는 웹이 쓰는 공용 코드(packages/core). package.json exports 표대로 소스 파일에 바로 잇는다(설치 없이)
const coreDir = path.resolve(__dirname, "../../packages/core");
const coreExports = JSON.parse(fs.readFileSync(`${coreDir}/package.json`, "utf8")).exports as Record<string, string>;
const coreAliases = Object.entries(coreExports).map(([key, file]) => ({
  find: new RegExp(`^@maengo/core/${key.slice(2).replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`),
  replacement: path.resolve(coreDir, file),
}));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 토스가 번들을 어느 경로에 올리든 열리게 상대 경로로
  base: "./",
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: path.resolve(__dirname, "src/shims/link.tsx") },
      // 오늘의 흐름 카드가 쓰는 웹 공급자 대신 토스판 값(로그인·회원 피드가 없다)
      { find: /^@\/components\/providers\/TodayProvider$/, replacement: path.resolve(__dirname, "src/shims/today.tsx") },
      { find: /^@\/components\/providers\/ProfileProvider$/, replacement: path.resolve(__dirname, "src/shims/profile.tsx") },
      { find: /^@\/components\/providers\/PlayerProvider$/, replacement: path.resolve(__dirname, "src/shims/player.tsx") },
      ...coreAliases,
      { find: /^@\//, replacement: `${web}/` },
    ],
    dedupe: ["react", "react-dom"],
  },
  build: { target: "es2019", sourcemap: false },
});
