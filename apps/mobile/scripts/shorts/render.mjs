// 소식 하나를 세로 쇼츠(1080×1920 mp4)로 만든다. TTS를 새로 부르지 않고 듣기 기능이 이미 만든 음성을 쓴다.
//   1) apps/web에서: node --conditions=react-server --env-file=.env.local --import tsx scripts/shorts-data.ts <clusterId> ../mobile/scripts/shorts/out/<clusterId>
//   2) 여기서:       node render.mjs out/<clusterId> [--stills=1,12,40] [--fps=30]
// --stills를 주면 그 시각(초)의 화면만 PNG로 찍는다(디자인 확인용). 결과 영상은 <dir>/short.mp4
// 입 모양은 음성 음량(프레임마다 0~1)으로 움직이고, 배경음악은 ../promo/bgm.mjs로 합성해 목소리 아래에 낮게 깐다.
// playwright-core는 저장소에 없다(store/README.md처럼 밖에 `npm i playwright-core@1.56.1`). 그 폴더를 PLAYWRIGHT_CORE로 넘긴다:
//   PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core/index.mjs node render.mjs out/<clusterId>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_CORE || "playwright-core");
const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || "").slice(name.length + 3);
const dir = path.resolve(process.argv[2] || "");
const fps = +(arg("fps") || 30);
const stills = arg("stills") ? arg("stills").split(",").map(Number) : null;
const data = JSON.parse(readFileSync(path.join(dir, "data.json"), "utf8"));
const voice = path.join(dir, "voice.mp3");

// 음량: 프레임 길이마다 RMS → 상위 5% 값으로 나눠 0~1 → 빨리 열고 천천히 닫게 다듬는다
const SR = 16000;
const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", voice, "-f", "s16le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
const per = SR / fps;
const rms = [];
for (let i = 0; i * per < samples.length; i++) {
  let sum = 0, n = 0;
  for (let j = Math.floor(i * per); j < Math.min(samples.length, Math.floor((i + 1) * per)); j++, n++) sum += samples[j] * samples[j];
  rms.push(n ? Math.sqrt(sum / n) : 0);
}
const ref = [...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.95)] || 1;
const amp = [];
let level = 0;
for (const r of rms) {
  const x = Math.min(1, r / ref);
  level += (x - level) * (x > level ? 0.65 : 0.3);
  amp.push(+(level < 0.12 ? 0 : level).toFixed(3));
}

const browser = await chromium.launch({ channel: "chrome" });
const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })).newPage();
await page.goto("file://" + path.join(here, "stage.html"), { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(([d, a, f]) => window.init(d, a, f), [data, amp, fps]);
await page.waitForTimeout(300);

if (stills) {
  for (const t of stills) {
    await page.evaluate((t) => window.seek(t), t);
    const out = path.join(dir, `still-${t}.png`);
    await page.screenshot({ path: out });
    console.log("wrote", out);
  }
  await browser.close();
  process.exit(0);
}

const frames = path.join(dir, "frames");
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames);
const total = Math.round(duration * fps);
console.log(`#${data.clusterId} ${duration.toFixed(1)}초, ${total}프레임 @${fps}fps`);
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.seek(t), i / fps);
  await page.screenshot({ path: path.join(frames, String(i).padStart(5, "0") + ".png") });
  if (i % 300 === 0) console.log(`frame ${i}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
await browser.close();

// 배경음악: 목소리 동안은 낮게, 마무리에서 조금 올렸다가 끝에서 줄인다
const bgm = path.join(dir, "bgm.wav");
execFileSync("node", [path.join(here, "../promo/bgm.mjs"), String(Math.ceil(duration) + 1), bgm], { stdio: "inherit" });
const voiceEnd = data.durationMs / 1000;
const out = path.join(dir, "short.mp4");
execFileSync("ffmpeg", [
  "-y", "-v", "error",
  "-framerate", String(fps), "-i", path.join(frames, "%05d.png"),
  "-i", voice, "-i", bgm,
  "-filter_complex",
  `[2:a]volume='if(lt(t,${voiceEnd}),0.10,0.30)':eval=frame,afade=t=in:d=0.8,afade=t=out:st=${(duration - 1.2).toFixed(2)}:d=1.2[b];` +
    `[1:a]apad[v];[v][b]amix=inputs=2:normalize=0:duration=shortest[aout]`,
  "-map", "0:v", "-map", "[aout]", "-t", duration.toFixed(2),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart",
  "-c:a", "aac", "-b:a", "160k", out,
], { stdio: "inherit" });
rmSync(frames, { recursive: true, force: true });
console.log("wrote", out);
