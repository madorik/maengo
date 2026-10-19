import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
const BASE = "http://localhost:3100/maengo";
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "ko-KR",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MaengoApp/1.2.0 (ios)" });
await ctx.addInitScript(() => localStorage.setItem("maengo_terms_seen", "2026-10-14"));
await ctx.addCookies([{ name: "maengo_listen_collapsed", value: "1", url: "http://localhost:3100" }]);
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.getByRole("button", { name: /데모/ }).first().click();
await page.waitForURL(/\/(today|onboarding)/, { timeout: 30000 });
const bb = JSON.parse(readFileSync("raw/bbox.json", "utf8"));
async function open(name) {
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /전체 듣기/ }).first().click();
  await page.waitForTimeout(2500);
  const unfold = page.getByRole("button", { name: /플레이어 펼치기/ }).first();
  if (await unfold.count()) { await unfold.click(); await page.waitForTimeout(1200); }
  const bar = page.getByRole("button", { name: /플레이어 창 열기/ }).first();
  if (await bar.count()) { const b = await bar.boundingBox(); bb.bbox[`${name}-bar`] = b; await bar.click(); await page.waitForTimeout(2500); }
  await page.screenshot({ path: `raw/${name}-player.png` });
  const tab = page.getByRole("tab", { name: /대본/ }).first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(1500); await page.screenshot({ path: `raw/${name}-script.png` }); }
  console.log("shot", name);
}
await page.goto(`${BASE}/today`, { waitUntil: "load" }); await open("today");
await page.goto(`${BASE}/playlist`, { waitUntil: "load" });
const close = page.getByRole("button", { name: /플레이어 창 닫기/ }).first(); if (await close.count()) { await close.click(); await page.waitForTimeout(800); }
await open("playlist");
writeFileSync("raw/bbox.json", JSON.stringify(bb, null, 2));
await browser.close();
