// 설정 > 듣기 미리 듣기 샘플(MP3)을 만든다. Gemini TTS 무료 한도가 서비스 전체 하루 10번이라 이미 있는 파일은 건너뛴다.
// 실행(apps/web에서): node --conditions=react-server --env-file=.env.local --import tsx scripts/voice-samples.ts [--force]
// react-server 조건은 server-only 모듈(mp3·ai)을 스크립트에서 불러오려고 붙인다.
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tts, ttsModel } from "../lib/server/ai";
import { encodeMp3 } from "../lib/server/mp3";
import { SAMPLE_LINES, SAMPLES, samplePath } from "../lib/voice-samples";

const force = process.argv.includes("--force");
const pub = path.join(import.meta.dirname, "..", "public");

for (const { persona, vk } of SAMPLES) {
  const file = path.join(pub, samplePath(persona, vk));
  if (existsSync(file) && !force) {
    console.log(`건너뜀 ${path.basename(file)}(이미 있음)`);
    continue;
  }
  const speech = await tts.speak({ model: ttsModel(), persona, voice: vk, lines: SAMPLE_LINES[persona] });
  const mp3 = encodeMp3(speech.pcm, speech.sampleRate);
  writeFileSync(file, mp3);
  console.log(`만듦 ${path.basename(file)} ${(speech.durationMs / 1000).toFixed(1)}초 ${(mp3.length / 1024).toFixed(0)}KB`);
}
