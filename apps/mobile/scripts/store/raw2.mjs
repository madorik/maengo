// 2026-11-10 개편판 스토어 원본 캡처(로컬 개발 서버 :3000, 로컬 DB 데모 계정, 앱 UA). node raw2.mjs <outDir> <w> <h> <scale> <ios|android> <main|pm|onboarding>
// 개발 표시(N)는 숨긴다. 듣기는 누르지 않는다. 맹고 AI 화면은 추천 질문 하나를 실제로 묻는다(Gemini 1번)
import { chromium } from "playwright-core";

const [outDir, w, h, scale, platform, phase = "main"] = process.argv.slice(2);
const BASE = "http://localhost:3000/maengo";
const UA = {
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MaengoApp/1.3.0 (ios)",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 MaengoApp/1.3.0 (android)",
}[platform];
const HIDE = "nextjs-portal{display:none!important}";

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale, isMobile: true, hasTouch: true, colorScheme: "light", locale: "ko-KR", userAgent: UA });
await ctx.addInitScript(() => {
  localStorage.setItem("maengo_terms_seen", "2026-11-01");
  localStorage.setItem("maengo:today-view", "route");
  localStorage.setItem("maengo:library-view", "list");
  localStorage.setItem("maengo_feature_tour_seen", "1");
});
await ctx.addCookies([{ name: "maengo_listen_collapsed", value: "1", url: "http://localhost:3000" }]);
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.getByRole("button", { name: /데모/ }).first().click();
await page.waitForURL(/\/(today|onboarding)/, { timeout: 30000 });

async function settle() {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(1800);
}
async function shoot(path, name, prepare) {
  if (path) await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await settle();
  if (prepare) await prepare();
  await page.addStyleTag({ content: HIDE });
  await page.screenshot({ path: `${outDir}/${platform}-${name}.png` });
  console.log("shot", platform, name, page.url());
}

if (phase === "onboarding") {
  await shoot("/onboarding", "pick", async () => {
    const tiles = page.locator("button[aria-pressed]");
    for (const i of [0, 1, 3]) await tiles.nth(i).click();
    await page.waitForTimeout(400);
  });
  await page.getByRole("button", { name: /내 관심사 찾기/ }).click();
  await page.waitForTimeout(2600);
  await shoot(null, "found");
} else if (phase === "pm") {
  await shoot("/today", "today-pm");
} else {
  // 리포트를 먼저 열어 오늘 화면의 '리포트가 나왔어요' 카드를 거둔다
  await shoot("/report", "report");
  await shoot("/today", "today");
  const href = (await page.locator('a[href*="/article/"]').nth(1).getAttribute("href")).replace(/^\/maengo/, "");
  await shoot(href, "article");
  // 플레이어 창(재생 목록). 열기만 하고 재생은 하지 않는다(음성 비용)
  await shoot("/today", "listen", async () => {
    const bubble = page.getByRole("button", { name: /플레이어 펼치기/ });
    if (await bubble.count()) await bubble.first().click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /플레이어 창 열기/ }).first().click();
    await page.waitForTimeout(1800);
  });
  await shoot("/library", "library");
  await shoot(href, "ask", async () => {
    await page.getByRole("button", { name: "맹고 AI에게 물어보기" }).click();
    const sheet = page.getByRole("dialog").last();
    const chip = sheet.locator("button.rounded-full").first();
    await chip.waitFor({ timeout: 30000 });
    await chip.click();
    await sheet.locator("ol > li").nth(1).waitFor({ timeout: 40000 });
    await page.getByRole("status", { name: "답을 쓰는 중" }).waitFor({ state: "detached", timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(1500);
  });
}
await browser.close();
