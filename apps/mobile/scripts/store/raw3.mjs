// 2026-11-11 스토어 원본 캡처(1.3.4, 로컬 개발 서버 :3000, 로컬 DB 데모 계정, 앱 UA). node raw3.mjs <outDir> <w> <h> <scale> <ios|android> <main|pm|onboarding>
// raw2에서 바뀐 것: 듣는 중 오늘 화면(playing, 로컬은 가짜 음성이라 비용 없음), 물어보기는 예상 질문 칩 화면만(첫 소식은 칩이 로컬 DB에 있어 Gemini를 부르지 않는다),
// 플레이어 창(listen)·'찾았어요'(found, 화면이 없어졌다)는 뺐다
import { chromium } from "playwright-core";

const [outDir, w, h, scale, platform, phase = "main"] = process.argv.slice(2);
const BASE = "http://localhost:3000/maengo";
const UA = {
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MaengoApp/1.3.4 (ios)",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 MaengoApp/1.3.4 (android)",
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
} else if (phase === "pm") {
  await shoot("/today", "today-pm");
} else {
  // 리포트를 먼저 열어 오늘 화면의 '리포트가 나왔어요' 카드를 거둔다
  await shoot("/report", "report");
  await shoot("/today", "today");
  // 듣는 중: 처음부터 들려 두고 맨 위로(머리말·듣는 중 막대·첫 소식의 망고), 망고는 커진 순간으로 세운다
  await shoot(null, "playing", async () => {
    const replay = page.getByRole("button", { name: "처음부터 다시 듣기" });
    if (await replay.count()) await replay.first().click();
    else await page.locator('[data-tour="listen-all"]').click();
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => [...document.querySelectorAll("audio")].some((a) => !a.paused))) break;
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(900);
    await page.addStyleTag({ content: ".mango-ride{animation:none!important;transform:scale(1.1)}" });
  });
  await page.evaluate(() => document.querySelectorAll("audio").forEach((a) => a.pause()));
  const href = (await page.locator('ol[aria-label="노선"] a[href*="/article/"]').first().getAttribute("href")).replace(/^\/maengo/, "");
  await shoot(href, "article");
  await shoot("/library", "library");
  await shoot(href, "ask", async () => {
    await page.getByRole("button", { name: "이 소식에 대해 물어보기" }).click();
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      if (!(await page.locator("text=AI가 예상 질문을 생각하고 있어요").count())) break;
    }
    await page.waitForTimeout(1000);
  });
}
await browser.close();
