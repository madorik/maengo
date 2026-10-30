// 설정 > 듣기 미리 듣기 샘플과 음성을 만드는 동안 트는 안내(MP3)를 기본 음성(Chirp, Free)과 Premium 음성(Gemini)으로 하나씩 만든다. 이미 있는 파일은 건너뛴다.
// 안내 뒤에는 띵 소리를 붙인다(wait-chime.ts).
// 실행(apps/web에서): node --conditions=react-server --env-file=.env.local --import tsx scripts/voice-samples.ts [--force | --wait]
// --force는 모두 다시, --wait는 안내만 다시 만든다.
// react-server 조건은 server-only 모듈(mp3·ai)을 스크립트에서 불러오려고 붙인다.
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { basicTts, premiumTts } from "../lib/server/ai";
import { encodeMp3 } from "../lib/server/mp3";
import { SAMPLE_LINES, SAMPLES, samplePath, WAIT_LINES, waitPath } from "../lib/voice-samples";
import { withChimes } from "./wait-chime";

const force = process.argv.includes("--force");
const waitOnly = process.argv.includes("--wait");
const pub = path.join(import.meta.dirname, "..", "public");

const jobs = [basicTts, premiumTts].flatMap((engine) =>
  SAMPLES.flatMap(({ persona, voice }) => [
    { engine, persona, voice, file: samplePath(persona, voice, engine.id), lines: SAMPLE_LINES, wait: false },
    { engine, persona, voice, file: waitPath(voice, engine.id), lines: WAIT_LINES, wait: true },
  ]),
).filter((job) => !waitOnly || job.wait);

for (const { engine, persona, voice, file: rel, lines, wait } of jobs) {
  const file = path.join(pub, rel);
  if (existsSync(file) && !force && !waitOnly) {
    console.log(`건너뜀 ${path.basename(file)}(이미 있음)`);
    continue;
  }
  const speech = await engine.client.speak({ model: engine.model, persona, voice, lines });
  const mp3 = encodeMp3(wait ? withChimes(speech.pcm, speech.sampleRate) : speech.pcm, speech.sampleRate);
  writeFileSync(file, mp3);
  console.log(`만듦 ${path.basename(file)} ${(speech.durationMs / 1000).toFixed(1)}초 ${(mp3.length / 1024).toFixed(0)}KB`);
}
