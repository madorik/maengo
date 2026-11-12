// 스토어 스크린샷·그래픽 만들기. node compose.mjs <rawDir> <outDir> <iconSvgPath> [--en]
// --en: Play 맞춤 등록정보(해외 30개국)용 영어 캡션판, 안드로이드만(2026-11-06). 앱 화면은 한국어 그대로
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const [rawDir, outDir, iconPath] = process.argv.slice(2).filter((a) => a !== "--en");
const EN = process.argv.includes("--en");
const img = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
const icon = `data:image/svg+xml;base64,${readFileSync(iconPath).toString("base64")}`;

// 2026-11-10 개편판: 하루 두 번 브리핑(출근길·퇴근길)부터, 듣기·맹고 AI·관심사 찾기·요약·보관함 골라 듣기·주간 리포트(Premium).
// Play 휴대전화 스크린샷은 8장까지. 원본은 로컬 개발 서버에서 데모 계정으로 찍었다(raw2.mjs, 맹고-문서/스토어-스크린샷.md)
const SLIDES_KO = [
  // 2026-11-12(1.3.5) 재테크하는 직장인(맹고-문서/타겟.md): 맞춤 인사이트·맞춤 체크가 보이는 오늘 화면부터. 원본은 raw4.mjs, 온보딩(pick)은 11-11 원본.
  // 퇴근길·보관함은 뺐다(6장)
  { raw: "today", lines: ["오늘 뉴스가", "내게 미칠 영향까지"] },
  { raw: "playing", lines: ["출근길엔", "누르면 바로 읽어 줘요"] },
  { raw: "article", lines: ["핵심만 짧게 요약하고", "원문은 바로 확인해요"] },
  { raw: "ask", lines: ["궁금한 건 예상 질문을", "골라 바로 물어봐요"] },
  { raw: "report", lines: ["한 주 소식도", "내 상황에 맞춰 정리해요"] },
  { raw: "pick", lines: ["끌리는 소식만 고르면", "관심사는 맹고가 찾아요"] },
];

const SLIDES_EN = [
  { raw: "playlist", lines: ["Your own playlist,", "played in a row"] },
  { raw: "ask", lines: ["Got a question?", "Ask Maengo AI"] },
  { raw: "today", lines: ["Only your topics,", "top stories first"] },
  { raw: "article", lines: ["Key points first,", "plus the source"] },
  { raw: "listen", lines: ["No time to read?", "Listen in Korean"] },
  { raw: "links", lines: ["Follow any blog", "with just a link"] },
  { raw: "library", lines: ["Past stories,", "all in one place"] },
  { raw: "article-dark", lines: ["Dark mode", "for night reading"], dark: true },
];
const SLIDES = EN ? SLIDES_EN : SLIDES_KO;

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
    h1{position:absolute;left:${pad}px;right:${pad}px;top:${Math.round(H * 0.075)}px;font-size:${cap}px;line-height:1.28;font-weight:900;letter-spacing:${EN ? "-0.02em;white-space:nowrap" : "-0.045em"};color:${dark ? "#FFC23D" : "#1F2340"};word-break:keep-all}
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
  </style></head><body><img class="icon" src="${icon}">${EN ? "<h1>Maengo</h1><p>Korean news on your topics, summarized and read aloud</p>" : "<h1>맹고</h1><p>금리·환율·주식, 내게 미칠 영향까지</p>"}<div class="phone"><img src="${shot}"></div></body></html>`;
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

for (const [platform, W, H] of EN ? [["android", 360, 640]] : [["ios", 430, 932], ["android", 360, 640]]) {
  for (const [i, s] of SLIDES.entries()) {
    await render(slideHtml({ ...s, src: img(`${rawDir}/${platform}-${s.raw}.png`) }, W, H), W, H, 3, `${outDir}/${platform}-${i + 1}-${s.raw}.png`);
  }
}
await render(featureHtml(img(`${rawDir}/android-today.png`)), 1024, 500, 1, `${outDir}/play-feature-1024x500.png`);
await browser.close();
