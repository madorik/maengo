// 홍보 영상용 실제 앱 화면 캡처(데모 계정, iOS UA, 로컬 운영 빌드 3100). node capture.mjs <outDir>
// raw.mjs(apps/mobile/scripts/store)와 같은 방식. 탭 위치용으로 버튼 좌표(CSS px)도 bbox.json에 남긴다.
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const outDir = process.argv[2] || "raw";
const BASE = "http://localhost:3100/maengo";
const W = 393, H = 852, SCALE = 3;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MaengoApp/1.2.0 (ios)";

const bbox = {};
const browser = await chromium.launch({ channel: "chrome" });

async function session({ collapsed }) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
    locale: "ko-KR",
    userAgent: UA,
  });
  await ctx.addInitScript(() => localStorage.setItem("maengo_terms_seen", "2026-10-14"));
  if (collapsed) await ctx.addCookies([{ name: "maengo_listen_collapsed", value: "1", url: "http://localhost:3100" }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.getByRole("button", { name: /데모/ }).first().click();
  await page.waitForURL(/\/(today|onboarding)/, { timeout: 30000 });
  return page;
}

async function settle(page, ms = 1500) {
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function shot(page, name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log("shot", name, page.url());
}

async function box(page, locator, key) {
  const b = await locator.boundingBox().catch(() => null);
  if (b) bbox[key] = b;
  console.log("bbox", key, b);
}

// 0) 데모 도구: 이미 요약된 소식으로 오늘 피드를 다시 고른다(Premium 10개, AI 호출 없음)
const page = await session({ collapsed: true });
if (process.argv.includes("--rebuild")) {
  await page.goto(`${BASE}/settings`, { waitUntil: "load" });
  await settle(page);
  const rebuild = page.getByRole("button", { name: "오늘 피드 다시 고르기" });
  if (await rebuild.count()) {
    await rebuild.first().click();
    await page.waitForTimeout(4000);
    console.log("feed rebuilt");
  } else console.log("demo tools not found");
}

// 1) 오늘: 듣기 창 접힌 상태 → 전체 듣기 탭 → 듣는 중
await page.goto(`${BASE}/today`, { waitUntil: "load" });
await settle(page);
const FOLD = /플레이어 접기|듣기 창 접기/;
const fold = page.getByRole("button", { name: FOLD });
if (await fold.count()) await fold.first().click().catch(() => {});
await page.waitForTimeout(800);
await shot(page, "today");
const listenAll = page.getByRole("button", { name: /전체 듣기/ }).first();
await box(page, listenAll, "today-listen-all");
await listenAll.click();
await page.waitForTimeout(2500);
await shot(page, "today-listening-1");
await page.waitForTimeout(3500);
await shot(page, "today-listening-2");
// 듣기 창을 펼친 상태가 따로 있으면
const unfold = page.getByRole("button", { name: /플레이어 펼치기|플레이어 창 열기|듣기 창 펼치기/ });
if (await unfold.count()) {
  await box(page, unfold.first(), "today-unfold");
  await unfold.first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "today-listening-open");
}

// 2) 플레이리스트: 목록 → 전체 듣기 탭
await page.goto(`${BASE}/playlist`, { waitUntil: "load" });
await settle(page);
const fold2 = page.getByRole("button", { name: FOLD });
if (await fold2.count()) await fold2.first().click().catch(() => {});
await page.waitForTimeout(800);
await shot(page, "playlist");
const plAll = page.getByRole("button", { name: /전체 듣기/ }).first();
await box(page, plAll, "playlist-listen-all");
await plAll.click();
await page.waitForTimeout(3000);
await shot(page, "playlist-listening");

// 3) 설정: 관심사 → 내 관심 링크에 주소 적기(저장하지 않음)
await page.goto(`${BASE}/settings`, { waitUntil: "load" });
await settle(page);
const fold3 = page.getByRole("button", { name: FOLD });
if (await fold3.count()) await fold3.first().click().catch(() => {});
await page.waitForTimeout(800);
await shot(page, "settings");
const interests = page.getByText("관심사", { exact: true }).first();
await interests.scrollIntoViewIfNeeded().catch(() => {});
await page.evaluate(() => window.scrollBy(0, -80));
await page.waitForTimeout(800);
await shot(page, "settings-interests");
const linkHead = page.getByText("내 관심 링크", { exact: true }).first();
await linkHead.scrollIntoViewIfNeeded().catch(() => {});
await page.evaluate(() => window.scrollBy(0, -120));
await page.waitForTimeout(800);
await shot(page, "settings-links");
const input = page.getByPlaceholder(/블로그·사이트 주소/).first();
if (await input.count()) {
  await box(page, input, "settings-link-input");
  await input.click();
  await input.fill("https://toss.tech");
  await page.waitForTimeout(800);
  await shot(page, "settings-link-typed");
  const addBtn = page.getByRole("button", { name: /추가|등록/ }).first();
  if (await addBtn.count()) await box(page, addBtn, "settings-link-add");
}

// 4) 글 화면
await page.goto(`${BASE}/today`, { waitUntil: "load" });
await settle(page);
const href = await page.locator('a[href*="/article/"]').first().getAttribute("href");
await page.goto(`http://localhost:3100${href}`, { waitUntil: "load" });
await settle(page);
await shot(page, "article");

writeFileSync(`${outDir}/bbox.json`, JSON.stringify({ viewport: { W, H, SCALE }, bbox }, null, 2));
await browser.close();
