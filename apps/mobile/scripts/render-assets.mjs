// 아이콘·스플래시 원본 PNG를 만든다. 아이콘은 "소리 막대 망고"(2026-11-25 사용자 결정: 웃는 망고 캐릭터가 너무 가벼워 보인다 →
// 남색 바탕에 음성 막대로 그린 주황 망고). apps/web/app/icon.svg·components/MangoIcon.tsx와 같은 그림이다. 스플래시는 남색 바탕에 같은 모양.
// 만든 PNG로 `npx @capacitor/assets@3.0.5 generate --ios --android`가 iOS·안드로이드 크기별 파일을 만든다(APP_PLAN.md 참고).
// 안드로이드 12+ 스플래시 아이콘(res/drawable-*/splash_icon.png), 웹 apple-icon.png, iOS 위젯 머리 아이콘(Mango.imageset)은 이 스크립트가 바로 넣는다.
//   node scripts/render-assets.mjs
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";

const NAVY = "#1B1F3B";
const ORANGE = "#FFAA00";
const LEAF = "#FFD27A";

// 막대 다섯 개(망고 몸)와 잎. 좌표는 icon.svg와 같은 120×120
const MARK = [
  [25, 58.5, 28],
  [40, 44.5, 54],
  [55, 37.5, 66],
  [70, 42.5, 56],
  [85, 56.5, 30],
]
  .map(([x, y, h]) => `<rect x="${x}" y="${y}" width="10" height="${h}" rx="5" fill="${ORANGE}"/>`)
  .join("")
  .concat(`<path d="M64 32.5 C67 21.5 78 16.5 90 18.5 C87 29.5 76 34.5 64 32.5 Z" fill="${LEAF}"/>`);

/** 바탕까지 꽉 찬 아이콘(모서리는 각지게, 둥근 마스크는 OS가 씌운다) */
const iconSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120"><rect width="120" height="120" fill="${NAVY}"/>${MARK}</svg>`;

// 그림의 가운데와 가장 먼 점(잎 끝)까지의 거리. 스플래시는 이 원이 안드로이드 12+ 마스크 원(300칸에서 반지름 97) 안에 들게 줄인다
const CX = 60;
const CY = 61;
const R = 52;
const SPLASH_MARK = `<g transform="translate(150 150) scale(${97 / R}) translate(${-CX} ${-CY})">${MARK}</g>`;

const files = {
  // iOS·옛 안드로이드 아이콘: 꽉 찬 사각형(투명 모서리 없이)
  "icon-only": iconSvg(1024),
  // 안드로이드 적응형 아이콘 바탕
  "icon-background": `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 120 120"><rect width="120" height="120" fill="${NAVY}"/></svg>`,
  // 적응형 아이콘 앞면. @capacitor/assets가 두 층 모두 16.7% 안쪽으로 넣어서(inset) 이 그림 전체가 보이는 72dp가 된다.
  // 런처가 원으로 자르면 내접원만 남으므로 잎 끝까지 원 안에 여유 있게 들도록 0.92배로 줄인다
  "icon-foreground": `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 120 120"><g transform="translate(60 60) scale(0.92) translate(-60 -60)">${MARK}</g></svg>`,
  // 스플래시(2732, iOS·안드로이드 11 이하): 화면을 채우도록 가운데가 잘려 보인다. 393pt 폭 아이폰에서
  // 안드로이드 12+와 같은 크기(300칸 = 288dp)가 되게 300칸을 923px로 둔다(높이 852pt에 맞춰 보이는 폭 = 2732×393/852)
  splash: `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="${NAVY}"/><g transform="translate(904.5 904.5) scale(${923 / 300})">${SPLASH_MARK}</g></svg>`,
};

for (const [name, body] of Object.entries(files)) {
  await sharp(Buffer.from(body)).png().toFile(`assets/${name}.png`);
  console.log(`assets/${name}.png`);
}

// 안드로이드 12+ 스플래시 아이콘(styles.xml의 windowSplashScreenAnimatedIcon). @capacitor/assets가 만들지 않아 여기서 밀도별로 넣는다
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENSITY)) {
  const size = 288 * k;
  const out = `android/app/src/main/res/drawable-${d}/splash_icon.png`;
  mkdirSync(dirname(out), { recursive: true });
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 300 300">${SPLASH_MARK}</svg>`)).png().toFile(out);
  console.log(out);
}

// 웹 apple-icon.png(180, 모서리 없이 — iOS가 둥글게 자른다)와 iOS 위젯 머리 아이콘(20pt, 위젯이 둥글게 자른다)
for (const [out, size] of [
  ["../web/app/apple-icon.png", 180],
  ["ios/App/MaengoWidget/Assets.xcassets/Mango.imageset/Mango@2x.png", 40],
  ["ios/App/MaengoWidget/Assets.xcassets/Mango.imageset/Mango@3x.png", 60],
]) {
  await sharp(Buffer.from(iconSvg(size))).png().toFile(out);
  console.log(out);
}
