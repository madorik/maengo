// 아이콘·스플래시 원본 PNG를 만든다. 아이콘은 apps/web/app/icon.svg(망고)와 같고, 스플래시는 이어폰 끼고 소식 듣는 맹고다.
// 만든 PNG로 `npx @capacitor/assets@3.0.5 generate --ios --android`가 iOS·안드로이드 크기별 파일을 만든다(APP_PLAN.md 참고).
// 안드로이드 12+ 스플래시 아이콘(res/drawable-*/splash_icon.png)은 이 스크립트가 바로 넣는다.
//   node scripts/render-assets.mjs
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
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

// 스플래시 그림: 맹고(apps/web/components/Mascot.tsx와 같은 몸)가 손에 든 휴대폰에 유선 이어폰을 꽂고 "오늘의 소식입니다~"를 듣는다.
// 망고색 바탕에 몸이 묻히지 않게 흰 스티커 테두리를 두른다. sil이면 테두리용 실루엣(전부 흰색, 선을 두껍게)
const INK = "#191C32";
const SKY = "#1A8FE0";
const SKY_DARK = "#1270B3";
const ARM = "#E5A21F";
// 글자는 그림으로 굳어지므로 이 맥의 한글 글꼴로 그린다
const KFONT = "'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', sans-serif";

function listening(sil) {
  const T = 12;
  const f = (c) => (sil ? "#FFFFFF" : c);
  const st = sil ? ` stroke="#FFFFFF" stroke-width="${T}" stroke-linejoin="round"` : "";
  const sw = (n) => (sil ? n + T : n);
  let s = "";
  // 말풍선(왼쪽 위에서 왼쪽 이어폰을 가리킨다)
  s += `<path d="M28 62 L37 95 L48 62 Z" fill="${f("#1478C8")}"${st}/>`;
  s += `<rect x="4" y="24" width="86" height="42" rx="18" fill="${f("#1478C8")}"${st}/>`;
  if (!sil) {
    for (const [y, line] of [[41.5, "오늘의 소식"], [58.5, "입니다~"]]) {
      s += `<text x="47" y="${y}" text-anchor="middle" font-family="${KFONT}" font-size="14" font-weight="800" letter-spacing="-0.3" fill="#FFFFFF">${line}</text>`;
    }
  }
  // 몸·잎·얼굴
  s += `<path d="M100 46 C146 44 168 84 165 122 C162 158 130 180 96 177 C62 174 38 152 39 121 C40 99 52 86 63 73 C75 59 83 47 100 46 Z" fill="${f(MANGO)}"${st}/>`;
  if (!sil) {
    s += `<path d="M164 112 C166 150 136 178 98 177 C128 166 152 146 164 112 Z" fill="${SHADE}"/>`;
    s += `<ellipse cx="70" cy="88" rx="9" ry="16" transform="rotate(-30 70 88)" fill="#FFE08A"/>`;
  }
  s += `<rect x="96" y="34" width="8" height="15" rx="3" transform="rotate(15 100 42)" fill="${f("#7A4A2A")}"${st}/>`;
  s += `<path d="M102 44 C112 24 138 16 158 22 C148 42 124 50 102 44 Z" fill="${f("#34B36A")}"${st}/>`;
  if (!sil) {
    s += `<path d="M107 42 C122 34 138 28 152 24" fill="none" stroke="#23914F" stroke-width="3" stroke-linecap="round"/>`;
    s += `<circle cx="78" cy="112" r="16" fill="#fff"/><circle cx="122" cy="112" r="16" fill="#fff"/>`;
    s += `<circle cx="81" cy="115" r="8" fill="${INK}"/><circle cx="119" cy="115" r="8" fill="${INK}"/>`;
    s += `<circle cx="84" cy="111" r="2.6" fill="#fff"/><circle cx="122" cy="111" r="2.6" fill="#fff"/>`;
    s += `<path d="M91 136 Q100 145 109 136" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`;
    s += `<ellipse cx="64" cy="137" rx="8" ry="5" fill="#FF6F61" opacity="0.45"/><ellipse cx="136" cy="137" rx="8" ry="5" fill="#FF6F61" opacity="0.45"/>`;
  }
  // 이어폰 줄: 양쪽 귀 → 몸 아래 갈림 → 휴대폰 단자. 휴대폰 뒤로 지나가게 먼저 그린다
  s += `<g fill="none" stroke="${f(SKY)}" stroke-width="${sw(3)}" stroke-linecap="round">`;
  s += `<path d="M41 117 C34 158 64 194 108 196"/><path d="M165 117 C168 156 150 190 108 196"/><path d="M108 200 C114 212 164 212 173 186"/></g>`;
  s += `<rect x="103.5" y="191" width="9" height="11" rx="3.5" fill="${f(SKY_DARK)}"${st}/>`;
  for (const cx of [41, 165]) {
    s += `<rect x="${cx - 3.5}" y="112" width="7" height="9" rx="2.5" fill="${f(SKY_DARK)}"${st}/>`;
    s += `<circle cx="${cx}" cy="108" r="9.5" fill="${f(SKY)}"${st}/>`;
    if (!sil) s += `<circle cx="${cx - 2.5}" cy="105.5" r="4.5" fill="#4FB3F6"/><circle cx="${cx - 3.5}" cy="104" r="1.6" fill="#fff" opacity="0.9"/>`;
  }
  // 오른쪽 귀에서 퍼지는 소리
  if (!sil) s += `<g fill="none" stroke="${SKY}" stroke-width="2.6" stroke-linecap="round"><path d="M180 101 Q185 108 180 115"/><path d="M186 95 Q194 108 186 121"/></g>`;
  // 휴대폰(오른손, 얼굴 쪽으로 살짝 기울임). 화면에는 맹고와 재생 막대
  s += `<g transform="rotate(-12 170 154)"><rect x="155" y="128" width="30" height="51" rx="6" fill="${f(INK)}"${st}/>`;
  if (!sil) {
    s += `<rect x="158" y="132" width="24" height="42" rx="3.5" fill="#FFFFFF"/>`;
    s += `<circle cx="170" cy="144" r="5.5" fill="${MANGO}"/><path d="M171 139.5 C173 136.5 176 136 178 137 C176 139.5 173.5 140.2 171 139.5 Z" fill="#34B36A"/>`;
    [4, 9, 13, 8, 5].forEach((h, i) => (s += `<rect x="${161.6 + i * 4}" y="${161 - h / 2}" width="2.6" height="${h}" rx="1.3" fill="${SKY}"/>`));
  }
  s += `<rect x="167" y="178" width="6" height="8" rx="2" fill="${f(SKY)}"${st}/></g>`;
  // 팔과 손
  s += `<path d="M140 156 Q150 163 158 164" fill="none" stroke="${f(ARM)}" stroke-width="${sw(7)}" stroke-linecap="round"/>`;
  s += `<circle cx="159" cy="164" r="7" fill="${f(MANGO)}" stroke="${f(ARM)}" stroke-width="${sw(2.6)}"/>`;
  return s;
}

// 300×300 칸에 그린다. 안드로이드 12+ 스플래시는 아이콘 칸(288dp)의 가운데 2/3 원(192dp) 밖을 잘라서
// 테두리까지 반지름 97 원 안에 들어가게 줄인다(그림 좌표 (95,108)이 가운데, 테두리 포함 반지름 123)
const LISTEN = `<g transform="translate(150 150) scale(${97 / 123}) translate(-95 -108)">${listening(true)}${listening(false)}</g>`;

const files = {
  // iOS·옛 안드로이드 아이콘: 꽉 찬 사각형(투명 모서리 없이)
  "icon-only": svg(1024, `<rect width="200" height="200" fill="${MANGO}"/>${SHADE_PATH}${FACE}`),
  // 안드로이드 적응형 아이콘 바탕: 런처 마스크(원·둥근 사각형)에 따라 그늘이 조금 보이거나 가려진다
  "icon-background": svg(1024, `<rect width="200" height="200" fill="${MANGO}"/>${SHADE_PATH}`),
  // 적응형 아이콘 앞면. @capacitor/assets가 두 층 모두 16.7% 안쪽으로 넣어서(inset) 이 그림 전체가 보이는 72dp가 된다.
  // 런처가 원으로 자르면 내접원만 남으므로 잎 끝까지 원 안에 들도록 0.8배로 줄인다
  "icon-foreground": svg(1024, `<g transform="translate(100 104) scale(0.8) translate(-100 -100)">${FACE}</g>`),
  // 스플래시(2732, iOS·안드로이드 11 이하): 화면을 채우도록 가운데가 잘려 보인다. 393pt 폭 아이폰에서
  // 안드로이드 12+와 같은 크기(300칸 = 288dp)가 되게 300칸을 923px로 둔다(높이 852pt에 맞춰 보이는 폭 = 2732×393/852)
  splash: `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="${MANGO}"/><g transform="translate(904.5 904.5) scale(${923 / 300})">${LISTEN}</g></svg>`,
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
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 300 300">${LISTEN}</svg>`)).png().toFile(out);
  console.log(out);
}
