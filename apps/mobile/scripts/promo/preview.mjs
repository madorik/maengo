import { chromium } from "playwright-core";
import path from "node:path";
const here = process.cwd();
const times = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ channel: "chrome" });
const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
page.on("console", (m) => console.log("console:", m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto("file://" + path.join(here, "stage.html") + ("?theme=" + (process.env.THEME || "") + "&layout=" + (process.env.LAYOUT || "")), { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
for (const t of times) {
  await page.evaluate((t) => window.seek(t), t);
  await page.screenshot({ path: `preview/${process.env.THEME || "t"}-${t.toFixed(1)}.png` });
}
await browser.close();
console.log("ok");
