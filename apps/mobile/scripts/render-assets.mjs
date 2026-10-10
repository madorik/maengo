// 아이콘·스플래시 원본 PNG를 만든다. 그림은 apps/web/app/icon.svg(망고)와 같다.
// 만든 PNG로 `pnpm dlx @capacitor/assets generate`가 iOS·안드로이드 크기별 파일을 만든다(README 참고).
//   node scripts/render-assets.mjs
import sharp from "sharp";

const MANGO = "#FFC23D";
const SHADE = "#FF9F2E";

// 망고 얼굴과 잎(바탕 사각형 없이). 좌표는 icon.svg와 같은 200×200
const FACE = `
  <ellipse cx="44" cy="58" rx="11" ry="22" transform="rotate(-35 44 58)" fill="#FFE08A"/>
  <rect x="110" y="28" width="9" height="17" rx="3" transform="rotate(20 114 36)" fill="#7A4A2A"/>
  <path d="M118 40 C130 14 164 6 184 14 C174 38 144 50 118 40 Z" fill="#34B36A"/>
  <path d="M123 38 C140 30 160 22 178 16" fill="none" stroke="#23914F" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="70" cy="110" r="22" fill="#FFFFFF"/>
  <circle cx="130" cy="110" r="22" fill="#FFFFFF"/>
  <circle cx="74" cy="114" r="11" fill="#191C32"/>
  <circle cx="126" cy="114" r="11" fill="#191C32"/>
  <circle cx="78" cy="108" r="3.5" fill="#FFFFFF"/>
  <circle cx="130" cy="108" r="3.5" fill="#FFFFFF"/>
  <ellipse cx="50" cy="143" rx="11" ry="7" fill="#FF6F61" opacity="0.45"/>
  <ellipse cx="150" cy="143" rx="11" ry="7" fill="#FF6F61" opacity="0.45"/>
  <path d="M86 142 Q100 156 114 142" fill="none" stroke="#191C32" stroke-width="6" stroke-linecap="round"/>`;

// 오른쪽 아래 그늘. 모서리는 각지게 두고 둥근 마스크는 OS가 씌운다(iOS 마스크 반경이 원본 rx=45와 거의 같다)
const SHADE_PATH = `<path d="M200 105 L200 200 L80 200 C140 196 190 160 200 105 Z" fill="${SHADE}"/>`;

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">${body}</svg>`;

const files = {
  // iOS·옛 안드로이드 아이콘: 꽉 찬 사각형(투명 모서리 없이)
  "icon-only": svg(1024, `<rect width="200" height="200" fill="${MANGO}"/>${SHADE_PATH}${FACE}`),
  // 안드로이드 적응형 아이콘 바탕: 런처 마스크(원·둥근 사각형)에 따라 그늘이 조금 보이거나 가려진다
  "icon-background": svg(1024, `<rect width="200" height="200" fill="${MANGO}"/>${SHADE_PATH}`),
  // 적응형 아이콘 앞면. @capacitor/assets가 두 층 모두 16.7% 안쪽으로 넣어서(inset) 이 그림 전체가 보이는 72dp가 된다.
  // 런처가 원으로 자르면 내접원만 남으므로 잎 끝까지 원 안에 들도록 0.8배로 줄인다
  "icon-foreground": svg(1024, `<g transform="translate(100 104) scale(0.8) translate(-100 -100)">${FACE}</g>`),
  // 스플래시(2732): 화면 비율에 맞춰 가운데가 잘려 보이므로 얼굴을 가운데 1/4 크기로
  splash: svg(2732, `<rect width="200" height="200" fill="${MANGO}"/><g transform="translate(100 100) scale(0.26) translate(-108 -84)">${FACE}</g>`),
};

for (const [name, body] of Object.entries(files)) {
  await sharp(Buffer.from(body)).png().toFile(`assets/${name}.png`);
  console.log(`assets/${name}.png`);
}
