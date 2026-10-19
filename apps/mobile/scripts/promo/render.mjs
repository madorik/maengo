// stage.html을 프레임 단위로 찍어 mp4로 만든다. node render.mjs [fps] [out.mp4]
// stage.html은 window.seek(t초)로 그 시각의 화면을 그리고, window.DURATION(초)·window.CUES(효과음 시각)를 둔다.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const fps = +(process.argv[2] || 30);
const out = process.argv[3] || path.join(here, "maengo-promo.mp4");
// --theme=light|dark: stage.html의 배경·글자색 테마(사이트에 묻히게 넣을 때). 없으면 망고색 원본
const theme = (process.argv.find((a) => a.startsWith("--theme=")) || "").slice(8);
// --layout=top: 웹 페이지용 위쪽 붙임 배치
const layout = (process.argv.find((a) => a.startsWith("--layout=")) || "").slice(9);
const query = [theme && `theme=${theme}`, layout && `layout=${layout}`].filter(Boolean).join("&");
const frames = path.join(here, "frames" + (theme ? "-" + theme : "")); // 테마마다 따로(동시에 돌릴 수 있게)
const W = 1080, H = 1920;

// --reuse-frames: 화면은 그대로고 소리만 바꿀 때, 전에 찍은 frames/를 다시 쓴다(stage.html의 DURATION·CUES만 읽는다)
const reuse = process.argv.includes("--reuse-frames") && existsSync(path.join(frames, "00000.png"));
if (!reuse) { rmSync(frames, { recursive: true, force: true }); mkdirSync(frames); }

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto("file://" + path.join(here, "stage.html") + (query ? `?${query}` : ""), { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

const duration = await page.evaluate(() => window.DURATION);
const cues = await page.evaluate(() => window.CUES || []);
const total = Math.round(duration * fps);
console.log(`duration ${duration}s, ${total} frames @${fps}fps`);

const t0 = Date.now();
for (let i = 0; i < total && !reuse; i++) {
  const t = i / fps;
  await page.evaluate((t) => window.seek(t), t);
  await page.screenshot({ path: path.join(frames, String(i).padStart(5, "0") + ".png"), type: "png" });
  if (i % 60 === 0) console.log(`frame ${i}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
await browser.close();

// 오디오: 효과음(딸깍)·목소리 샘플을 시각에 맞춰 섞는다
const inputs = ["-framerate", String(fps), "-i", path.join(frames, "%05d.png")];
const filters = [];
const mixIn = [];
cues.forEach((c, i) => {
  inputs.push("-i", path.join(here, "assets", c.file));
  const idx = i + 1;
  const vol = c.volume ?? 1;
  // dur이 있으면 그만큼만 쓰고 끝 0.4초를 줄인다
  const trim = (c.tempo ? `atempo=${c.tempo},` : "") + (c.dur ? `atrim=0:${c.dur},afade=t=out:st=${Math.max(0, c.dur - 0.4)}:d=0.4,` : "");
  // duck이 있으면 그 구간(내레이션 등)에서는 level로 낮춘다(배경음악용). 시각은 adelay 뒤 기준이라 cue.at을 더한다
  const volExpr = c.duck
    ? `volume='if(between(t,${c.duck.from},${c.duck.to}),${c.duck.level},${vol})':eval=frame`
    : `volume=${vol}`;
  filters.push(`[${idx}:a]${trim}adelay=${Math.round(c.at * 1000)}|${Math.round(c.at * 1000)},${volExpr}[a${idx}]`);
  mixIn.push(`[a${idx}]`);
});
let args = ["-y", ...inputs];
if (cues.length) {
  filters.push(`${mixIn.join("")}amix=inputs=${cues.length}:normalize=0:dropout_transition=0,apad[aout]`);
  args.push("-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[aout]", "-shortest");
}
args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart");
if (cues.length) args.push("-c:a", "aac", "-b:a", "160k");
args.push(out);
writeFileSync(path.join(here, "ffmpeg-args.json"), JSON.stringify(args, null, 2));
execFileSync("ffmpeg", args, { stdio: "inherit" });
console.log("wrote", out);
