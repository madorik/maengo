// 홍보 영상 내레이션(MP3)을 앱의 아나운서 목소리로 만든다. 한 번에 한 파일, TTS 1회. 기본은 Premium 음성(Gemini), --basic이면 기본 음성(Chirp)
// 실행(apps/web에서): node --conditions=react-server --env-file=.env.local --import tsx scripts/promo-narration.ts <out.mp3> [f|m] [--basic] [문장…]
// 문장을 안 주면 아래 기본 문장을 읽는다. 문장 하나가 인자 하나(따옴표로 묶는다).
import { writeFileSync } from "node:fs";
import { basicTts, premiumTts } from "../lib/server/ai";
import { encodeMp3 } from "../lib/server/mp3";

const out = process.argv[2];
const vk = (process.argv[3] === "m" ? "m" : "f") as "f" | "m";
if (!out) throw new Error("out.mp3 경로를 주세요");

const engine = process.argv.includes("--basic") ? basicTts : premiumTts;
const given = process.argv.slice(4).filter((a) => a && a !== "--basic");
const lines = (given.length ? given : ["맹고 아나운서예요. 오늘의 관심 소식을 AI로 요약해서 들려드릴게요."]).map((text) => ({ text }));

const speech = await engine.client.speak({ model: engine.model, persona: "announcer", voice: vk, lines });
const mp3 = encodeMp3(speech.pcm, speech.sampleRate);
writeFileSync(out, mp3);
console.log(`만듦 ${out} ${(speech.durationMs / 1000).toFixed(1)}초 ${(mp3.length / 1024).toFixed(0)}KB`);
