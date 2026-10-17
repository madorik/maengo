// 맹고 화면 원본 캡처(데모 계정, 앱 UA, 운영 빌드). node raw.mjs <outDir> <width> <height> <scale> <ios|android>
import { chromium } from "playwright-core";

const [outDir, w, h, scale, platform] = process.argv.slice(2);
const BASE = "http://localhost:3100/maengo";
const UA = {
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MaengoApp/1.2.0 (ios)",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 MaengoApp/1.2.0 (android)",
}[platform];

const browser = await chromium.launch({ channel: "chrome" });

async function session(dark) {
  const ctx = await browser.newContext({
    viewport: { width: +w, height: +h },
    deviceScaleFactor: +scale,
    isMobile: true,
    hasTouch: true,
    colorScheme: dark ? "dark" : "light",
    locale: "ko-KR",
    userAgent: UA,
  });
  // 약관 바뀜 안내는 본 것으로
  await ctx.addInitScript(() => localStorage.setItem("maengo_terms_seen", "2026-10-14"));
  // 전체 듣기 창은 접은 상태(마스코트 동그라미만)
  await ctx.addCookies([{ name: "maengo_listen_collapsed", value: "1", url: "http://localhost:3100" }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.getByRole("button", { name: /데모/ }).first().click();
  await page.waitForURL(/\/(today|onboarding)/, { timeout: 30000 });
  return page;
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  const fold = page.getByRole("button", { name: "듣기 창 접기" });
  if (await fold.count()) await fold.first().click().catch(() => {});
  await page.waitForTimeout(1500);
}

async function shoot(page, path, name) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await settle(page);
  await page.screenshot({ path: `${outDir}/${platform}-${name}.png` });
  console.log("shot", platform, name, page.url());
}

const light = await session(false);
for (const [path, name] of [["/today", "today"], ["/playlist", "playlist"], ["/library", "library"], ["/settings", "settings"]]) {
  await shoot(light, path, name);
}
await light.goto(`${BASE}/today`, { waitUntil: "load" });
const href = await light.locator('a[href*="/article/"]').first().getAttribute("href");
await shoot(light, href.replace(/^\/maengo/, ""), "article");

const dark = await session(true);
await shoot(dark, href.replace(/^\/maengo/, ""), "article-dark");
await shoot(dark, "/library", "library-dark");

await browser.close();
