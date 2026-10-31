// 스토어 스크린샷·그래픽 만들기. node compose.mjs <rawDir> <outDir> <iconSvgPath>
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const [rawDir, outDir, iconPath] = process.argv.slice(2);
const img = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
const icon = `data:image/svg+xml;base64,${readFileSync(iconPath).toString("base64")}`;

const SLIDES = [
  { raw: "today", lines: ["관심 분야에서", "이슈도가 높은 소식만"] },
  { raw: "article", lines: ["핵심만 짧게 요약하고", "원문은 바로 확인해요"] },
  { raw: "listen", lines: ["읽기 힘들 땐", "귀로 들어요"] },
  { raw: "links", lines: ["자주 보는 블로그는", "링크만 넣어 두세요"] },
  { raw: "library", lines: ["지난 소식은", "보관함에서 찾아요"] },
  { raw: "article-dark", lines: ["밤에는 다크 모드로", "눈 편하게 읽어요"], dark: true },
];

const FONT = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">`;

function slideHtml({ src, lines, dark }, W, H) {
  // W·H는 CSS px(3배로 찍는다). 글씨·폰 크기는 폭 기준
  const pad = Math.round(W * 0.075);
  const cap = Math.round(W * 0.083);
  const phoneW = Math.round(W * 0.8);
  const bezel = Math.round(W * 0.022);
  const radius = Math.round(W * 0.095);
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>
    *{box-sizing:border-box;margin:0}
    html,body{width:${W}px;height:${H}px;overflow:hidden}
    body{background:${dark ? "#151722" : "#FFC23D"};font-family:"Pretendard Variable",Pretendard,sans-serif;position:relative}
    h1{position:absolute;left:${pad}px;right:${pad}px;top:${Math.round(H * 0.075)}px;font-size:${cap}px;line-height:1.28;font-weight:900;letter-spacing:-0.045em;color:${dark ? "#FFC23D" : "#1F2340"};word-break:keep-all}
    .phone{position:absolute;left:50%;transform:translateX(-50%);top:${Math.round(H * 0.075 + cap * 1.28 * 2 + H * 0.045)}px;width:${phoneW}px;padding:${bezel}px;border-radius:${radius}px;background:${dark ? "#2A2E40" : "#1F2340"};box-shadow:0 ${Math.round(W * 0.04)}px ${Math.round(W * 0.09)}px rgba(31,35,64,${dark ? 0.6 : 0.28})}
    .phone img{display:block;width:100%;border-radius:${radius - bezel}px}
  </style></head><body><h1>${lines.join("<br>")}</h1><div class="phone"><img src="${src}"></div></body></html>`;
}

function featureHtml(shot) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONT}<style>
    *{box-sizing:border-box;margin:0}
    html,body{width:1024px;height:500px;overflow:hidden}
    body{background:#FFC23D;font-family:"Pretendard Variable",Pretendard,sans-serif;position:relative;color:#1F2340}
    .icon{position:absolute;left:72px;top:96px;width:120px;height:120px;border-radius:28px;box-shadow:0 10px 24px rgba(31,35,64,.18)}
    h1{position:absolute;left:72px;top:236px;font-size:76px;font-weight:900;letter-spacing:-0.05em;line-height:1}
    p{position:absolute;left:72px;top:330px;width:470px;font-size:30px;font-weight:700;letter-spacing:-0.03em;line-height:1.35;word-break:keep-all}
    .phone{position:absolute;right:84px;top:58px;width:300px;padding:9px;border-radius:38px;background:#1F2340;transform:rotate(4deg);box-shadow:0 22px 48px rgba(31,35,64,.3)}
    .phone img{display:block;width:100%;border-radius:30px}
  </style></head><body><img class="icon" src="${icon}"><h1>맹고</h1><p>관심 분야 소식, 요약하고 읽어 드려요</p><div class="phone"><img src="${shot}"></div></body></html>`;
}

const browser = await chromium.launch({ channel: "chrome" });
async function render(html, w, h, scale, path) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path });
  await page.close();
  console.log("made", path);
}

for (const [platform, W, H] of [["ios", 430, 932], ["android", 360, 640]]) {
  for (const [i, s] of SLIDES.entries()) {
    await render(slideHtml({ ...s, src: img(`${rawDir}/${platform}-${s.raw}.png`) }, W, H), W, H, 3, `${outDir}/${platform}-${i + 1}-${s.raw}.png`);
  }
}
await render(featureHtml(img(`${rawDir}/android-article.png`)), 1024, 500, 1, `${outDir}/play-feature-1024x500.png`);
await browser.close();
