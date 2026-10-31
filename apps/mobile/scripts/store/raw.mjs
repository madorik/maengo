// 맹고 화면 원본 캡처(데모 계정, 앱 UA, 운영 빌드). node raw.mjs <outDir> <width> <height> <scale> <ios|android>
// 데모 계정이 Premium이어야 한다(하루 소식 10개·내 관심 링크 칸). 듣기는 누르지 않는다(음성을 새로 만들면 TTS 비용)
import { chromium } from "playwright-core";

const [outDir, w, h, scale, platform] = process.argv.slice(2);
const BASE = "http://localhost:3100/maengo";
const UA = {
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MaengoApp/1.3.0 (ios)",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 MaengoApp/1.3.0 (android)",
}[platform];
// 내 관심 링크 칸에 보여 줄 주소(저장하지 않는다. 칸을 벗어나면 저장되므로 포커스 없이 값만 넣는다)
const LINKS = ["news.hada.io", "openai.com/news", "blog.google/technology/ai"];

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
  await ctx.addInitScript(() => localStorage.setItem("maengo_terms_seen", "2026-11-01"));
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

async function shoot(page, path, name, prepare) {
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await settle(page);
  if (prepare) await prepare(page);
  await page.screenshot({ path: `${outDir}/${platform}-${name}.png` });
  console.log("shot", platform, name, page.url());
}

/** 설정을 관심사부터 보이게 내리고 내 관심 링크 칸을 채운다 */
async function links(page) {
  await page.evaluate((urls) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const inputs = [...document.querySelectorAll('#links input[name="link"]')];
    inputs.forEach((el, i) => {
      if (!urls[i] || el.value) return;
      set.call(el, urls[i]);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    document.getElementById("topics")?.scrollIntoView({ block: "start" });
  }, LINKS);
  await page.waitForTimeout(500);
}

const light = await session(false);
await shoot(light, "/today", "today");
const href = (await light.locator('a[href*="/article/"]').first().getAttribute("href")).replace(/^\/maengo/, "");
await shoot(light, href, "article");
await shoot(light, "/listen", "listen");
await shoot(light, "/settings", "links", links);
await shoot(light, "/library", "library");

const dark = await session(true);
await shoot(dark, href, "article-dark");

await browser.close();
