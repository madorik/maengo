// 설정 > 듣기 미리 듣기 샘플과 음성을 만드는 동안 트는 안내(MP3)를 기본 음성(Chirp, Free)과 Premium 음성(Gemini)으로 하나씩 만든다. 이미 있는 파일은 건너뛴다.
// 안내 뒤에는 띵 소리를 붙인다(wait-chime.ts).
// 실행(apps/web에서): node --conditions=react-server --env-file=.env.local --import tsx scripts/voice-samples.ts [--force | --wait]
// --force는 모두 다시, --wait는 안내만 다시 만든다.
// react-server 조건은 server-only 모듈(mp3·ai)을 스크립트에서 불러오려고 붙인다.
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { basicTts, premiumTts } from "../lib/server/ai";
import { encodeMp3 } from "../lib/server/mp3";
import { SAMPLE_LINES, SAMPLES, samplePath, waitCues, waitPath } from "../lib/voice-samples";
import { composeWait } from "./wait-chime";

/** 기다림 안내 파일 길이. 마지막 말(약 30초) 뒤로 띵 소리가 조금 더 이어지고 조용해진다 */
const WAIT_TOTAL_MS = 45_000;

const force = process.argv.includes("--force");
const waitOnly = process.argv.includes("--wait");
const pub = path.join(import.meta.dirname, "..", "public");

const jobs = [basicTts, premiumTts].flatMap((engine) =>
  SAMPLES.flatMap(({ persona, voice }) => [
    { engine, persona, voice, file: samplePath(persona, voice, engine.id), lines: SAMPLE_LINES, wait: false },
    { engine, persona, voice, file: waitPath(voice, engine.id), lines: [], wait: true },
  ]),
).filter((job) => !waitOnly || job.wait);

for (const { engine, persona, voice, file: rel, lines, wait } of jobs) {
  const file = path.join(pub, rel);
  if (existsSync(file) && !force && !waitOnly) {
    console.log(`건너뜀 ${path.basename(file)}(이미 있음)`);
    continue;
  }
  if (wait) {
    // 기다림 안내: 단계마다 말을 따로 만들어 그 시각에 두고 사이를 띵 소리로 채운다(lib/voice-samples.ts waitCues)
    const cues = [];
    let rate = 0;
    for (const { atMs, text } of waitCues(engine.id)) {
      const speech = await engine.client.speak({ model: engine.model, persona, voice, lines: [{ text }] });
      rate = speech.sampleRate;
      cues.push({ atMs, pcm16: speech.pcm });
    }
    const mp3 = encodeMp3(composeWait(cues, rate, WAIT_TOTAL_MS), rate);
    writeFileSync(file, mp3);
    console.log(`만듦 ${path.basename(file)} 말 ${cues.length}개 ${(WAIT_TOTAL_MS / 1000).toFixed(0)}초 ${(mp3.length / 1024).toFixed(0)}KB`);
    continue;
  }
  const speech = await engine.client.speak({ model: engine.model, persona, voice, lines });
  const mp3 = encodeMp3(speech.pcm, speech.sampleRate);
  writeFileSync(file, mp3);
  console.log(`만듦 ${path.basename(file)} ${(speech.durationMs / 1000).toFixed(1)}초 ${(mp3.length / 1024).toFixed(0)}KB`);
}
