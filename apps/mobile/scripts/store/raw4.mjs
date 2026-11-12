// 2026-11-12 스토어 원본 캡처(1.3.5, 재테크하는 직장인 판). node raw4.mjs <outDir> <w> <h> <scale> <ios|android>
// raw3에서 바뀐 것: 오늘 화면 맨 위(맞춤 인사이트·맞춤 체크가 한 화면에 보인다)부터. 보관함·퇴근길은 뺐고, 온보딩(pick)은 2026-11-11 원본을 그대로 쓴다.
// 로컬 개발 서버(:3000)·로컬 DB 데모 계정. 화면 속 이름은 로컬 profiles.display_name(블로그 사진과 같은 '지민')
import { chromium } from "playwright-core";
const [outDir, w, h, scale, platform] = process.argv.slice(2);
const BASE = "http://localhost:3000/maengo";
const UA = {
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MaengoApp/1.3.5 (ios)",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 MaengoApp/1.3.5 (android)",
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
  await page.waitForTimeout(2500);
}
async function shoot(path, name, prepare) {
  if (path) await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await settle();
  if (prepare) await prepare();
  await page.addStyleTag({ content: HIDE });
  await page.screenshot({ path: `${outDir}/${platform}-${name}.png` });
  console.log("shot", platform, name, page.url());
}
// 리포트를 먼저 열어 오늘 화면의 '리포트가 나왔어요' 카드를 거둔다
await shoot("/report", "report");
await shoot("/today", "today", async () => {
  // 맞춤 인사이트(미리 만들어 둔 것 또는 처음 만들기)가 보일 때까지
  for (let i = 0; i < 30; i++) {
    if (await page.getByText("맞춤 체크", { exact: true }).count()) break;
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
});
// 듣는 중: 처음부터 들려 두고 노선 머리로, 망고는 커진 순간으로 세운다
await shoot(null, "playing", async () => {
  const replay = page.getByRole("button", { name: "처음부터 다시 듣기" });
  if (await replay.count()) await replay.first().click();
  else await page.locator('[data-tour="listen-all"]').click();
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => [...document.querySelectorAll("audio")].some((a) => !a.paused))) break;
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const ol = document.querySelector('ol[aria-label="노선"]');
    if (ol) window.scrollTo(0, ol.getBoundingClientRect().top + window.scrollY - 260);
  });
  await page.waitForTimeout(900);
  await page.addStyleTag({ content: ".mango-ride{animation:none!important;transform:scale(1.1)}" });
});
await page.evaluate(() => document.querySelectorAll("audio").forEach((a) => a.pause()));
const href = (await page.locator('ol[aria-label="노선"] a[href*="/article/"]').first().getAttribute("href")).replace(/^\/maengo/, "");
await shoot(href, "article");
await shoot(href, "ask", async () => {
  await page.getByRole("button", { name: "이 소식에 대해 물어보기" }).click();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    if (!(await page.locator("text=AI가 예상 질문을 생각하고 있어요").count())) break;
  }
  await page.waitForTimeout(1000);
});
await browser.close();
