// 2026-11-26 스토어·소개 페이지 원본 캡처(1.3.6, 새 앱 아이콘·새 화면). node raw5.mjs <outDir> <w> <h> <scale> <ios|android> <main|pm|onboarding>
// raw4에서 바뀐 것: 오늘 화면(인사이트 제목 + 재생 원, 오늘의 흐름 사진 카드), 흐름 상세 시트(맹고 분석), 소식 상세(핵심 요약 상자), 보관함(줄 모양), 주간 리포트(남색 결론 카드),
// 플레이어 창(시간 표시 없음). 망고 캐릭터는 앱에서 모두 뺐다.
// 로컬 개발 서버(기본 :3200, PORT로 바꾼다)·로컬 DB 데모 계정. 개발 DB에서만 데모 상태를 바꾼다(찍은 뒤 되돌린다):
//  - main: 데모를 Premium(profiles.plan='plus', premium_until)으로, 이름은 '지민', 오늘 피드(feeds·feed_days)와 오늘 인사이트(briefing_insights)를 지난 날 것으로 복사해 둔다
//  - pm: 위 + 오늘 퇴근길 피드·인사이트(slot='pm'), .env.development.local의 DEV_BRIEFING_SLOT=pm
//  - onboarding: profiles.onboarded_at을 비운다
// 개발 표시(N)는 숨긴다. 맹고 AI 예상 질문은 로컬 DB(ask_suggestions)에 이미 있는 소식(우리투자증권 공모채)으로 열어 Gemini를 부르지 않는다
import { chromium } from "playwright-core";
const [outDir, w, h, scale, platform, mode = "main"] = process.argv.slice(2);
const PORT = process.env.PORT ?? "3200";
const BASE = `http://localhost:${PORT}/maengo`;
const UA = {
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MaengoApp/1.3.6 (ios)",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 MaengoApp/1.3.6 (android)",
}[platform];
const HIDE = "nextjs-portal{display:none!important}";
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale, isMobile: true, hasTouch: true, colorScheme: "light", locale: "ko-KR", userAgent: UA });
await ctx.addInitScript(() => {
  localStorage.setItem("maengo_terms_seen", "2026-11-01");
  localStorage.setItem("maengo:library-view", "list");
  localStorage.setItem("maengo_feature_tour_seen", "1");
});
await ctx.addCookies([{ name: "maengo_listen_collapsed", value: "1", url: `http://localhost:${PORT}` }]);
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.getByRole("button", { name: /데모/ }).first().click();
await page.waitForURL(/\/(today|onboarding)/, { timeout: 30000 });
async function settle() {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.addStyleTag({ content: HIDE });
  // 사진이 다 뜰 때까지
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete && (i.naturalWidth > 0 || !i.currentSrc)), null, { timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(2200);
}
async function shoot(path, name, prepare) {
  if (path) await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await settle();
  if (prepare) await prepare();
  await page.addStyleTag({ content: HIDE });
  await page.screenshot({ path: `${outDir}/${platform}-${name}.png` });
  console.log("shot", platform, name, page.url());
}
const hrefOf = async (text) => ((await page.locator("a[href*='/article/']").filter({ hasText: text }).first().getAttribute("href")) ?? "").replace(/^\/maengo/, "");

if (mode === "onboarding") {
  // 처음 화면: 대분류 카드 둘(경제·AI/로봇)을 골라 둔다
  await shoot("/onboarding", "pick", async () => {
    const cards = page.locator("button[aria-pressed]");
    await cards.nth(0).click();
    await cards.nth(1).click();
    await page.waitForTimeout(700);
  });
} else if (mode === "pm") {
  // 퇴근길 제목 화면(오늘 퇴근길 피드·인사이트와 DEV_BRIEFING_SLOT=pm이 있어야 한다)
  await shoot("/today", "today-pm", async () => {
    await page.waitForSelector('ul[aria-label="오늘의 흐름 카드"]', { timeout: 20000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
  });
} else {
  // 리포트를 먼저 열어 오늘 화면의 '리포트가 나왔어요' 카드를 거둔다
  await shoot("/report", "report");
  await shoot("/library", "library");
  // 오늘(출근길): 인사이트 제목 + 오늘의 흐름 사진 카드
  await shoot("/today", "today", async () => {
    await page.waitForSelector('ul[aria-label="오늘의 흐름 카드"]', { timeout: 20000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
  });
  const article = await hrefOf("골드만삭스");
  // 흐름 상세(맹고 분석): 두 번째 카드(부담 요인)
  await shoot(null, "flow", async () => {
    await page.locator('ul[aria-label="오늘의 흐름 카드"] li').nth(1).locator('button[aria-haspopup="dialog"]').click();
    await page.waitForTimeout(1600);
  });
  await page.keyboard.press("Escape");
  // 소식 상세: 맨 위 핵심 요약
  // 안드로이드(360×800)는 제목이 네 줄이라 핵심 요약 상자가 슬라이드 아래에서 잘린다 → 80px 내려서 상자가 통째로 보이게
  await shoot(article, "article", async () => {
    if (platform === "android") {
      await page.evaluate(() => window.scrollTo(0, 80));
      await page.waitForTimeout(600);
    }
  });
  // 맹고 AI 물어보기: 예상 질문 칩(로컬 DB에 질문이 있는 소식)
  await page.goto(`${BASE}/library?q=${encodeURIComponent("우리투자증권")}`, { waitUntil: "load" });
  await settle();
  const ask = await hrefOf("우리투자증권");
  // 안드로이드 슬라이드는 폰 아래가 잘려서(1080×1920에 폰이 길다) 예상 질문 칩 셋이 안 보인다 → 이 한 장만 화면을 680 높이로 찍는다
  if (platform === "android") await page.setViewportSize({ width: +w, height: 680 });
  await shoot(ask, "ask", async () => {
    await page.getByRole("button", { name: "이 소식에 대해 물어보기" }).click();
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      if (!(await page.locator("text=AI가 예상 질문을 생각하고 있어요").count())) break;
    }
    await page.waitForTimeout(1000);
  });
  if (platform === "android") await page.setViewportSize({ width: +w, height: +h });
  // 듣는 중: 처음부터 들려 두고 플레이어 창을 열어, 막대가 조금 간 때
  await page.goto(`${BASE}/today`, { waitUntil: "load" });
  await settle();
  await page.locator('[data-tour="listen-all"]').first().click();
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => [...document.querySelectorAll("audio")].some((a) => !a.paused && a.currentTime > 0))) break;
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(800);
  // 접힌 둥근 버튼(쿠키 maengo_listen_collapsed)이면 먼저 펼친다
  const expand = page.getByRole("button", { name: /^플레이어 펼치기/ });
  if (await expand.count()) {
    await expand.first().click();
    await page.waitForTimeout(600);
  }
  await page.getByRole("button", { name: "플레이어 창 열기" }).first().click();
  await page.waitForTimeout(9000);
  await page.addStyleTag({ content: HIDE });
  await page.screenshot({ path: `${outDir}/${platform}-listen.png` });
  console.log("shot", platform, "listen", page.url());
  await page.evaluate(() => document.querySelectorAll("audio").forEach((a) => a.pause()));
}
await browser.close();
