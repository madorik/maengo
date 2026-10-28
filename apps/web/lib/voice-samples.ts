import type { Persona, ScriptLine, Voice } from "@maengo/core/types";
import { withBase } from "./base-path";

// 설정 > 듣기의 미리 듣기. 목소리마다 짧은 인사를 한 번만 만들어 public/voice-samples에 두고(scripts/voice-samples.ts),
// 들을 때는 정적 파일만 튼다(TTS를 다시 부르지 않는다). 문구를 바꾸면 스크립트를 --force로 다시 돌린다.
export const SAMPLE_LINES: ScriptLine[] = [{ text: "안녕하세요, 맹고 아나운서예요. 관심 있는 주제를 모아서 요약해 드릴게요." }];

/** 만들어 둘 샘플: 아나운서의 여성·남성 목소리 */
export const SAMPLES: { persona: Persona; voice: Voice }[] = [
  { persona: "announcer", voice: "f" },
  { persona: "announcer", voice: "m" },
];

export function samplePath(persona: Persona, voice: Voice): string {
  return `/voice-samples/${persona}-${voice}.mp3`;
}

export function sampleUrl(persona: Persona, voice: Voice): string {
  return withBase(samplePath(persona, voice));
}

/**
 * 음성을 만드는 동안 틀어 주는 안내(PlayerProvider). 화면 문구(lib/player/labels.ts의 PREPARING_TEXT)와 같은 말을 아나운서 목소리로.
 * 목소리마다 한 번 만들어 public/voice-samples에 둔다(scripts/voice-samples.ts, 2026-10-25 사용자 결정)
 */
export const WAIT_LINES: ScriptLine[] = [{ text: "AI가 요약을 음성으로 변환하고 있어요." }, { text: "조금만 기다려주세요." }];

export function waitPath(voice: Voice): string {
  return `/voice-samples/wait-${voice}.mp3`;
}

export function waitUrl(voice: Voice): string {
  return withBase(waitPath(voice));
}
