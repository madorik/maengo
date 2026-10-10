import { voiceKey } from "@maengo/core/audio";
import type { Persona, ScriptLine, Voice, VoiceKey } from "@maengo/core/types";

// 설정 > 듣기의 미리 듣기. 말투·목소리마다 짧은 인사를 한 번만 만들어 public/voice-samples에 두고(scripts/voice-samples.ts),
// 들을 때는 정적 파일만 튼다(TTS를 다시 부르지 않는다). 문구를 바꾸면 스크립트를 --force로 다시 돌린다.
export const SAMPLE_LINES: Record<Persona, ScriptLine[]> = {
  announcer: [{ text: "안녕하세요, 맹고 아나운서예요. 관심 있는 주제를 모아서 요약해 드릴게요." }],
  teacher: [{ text: "안녕하세요, 맹고 선생님이에요. 관심 있는 주제를 모아서 요약해 드릴게요." }],
  dialogue: [
    { who: "진행자", text: "안녕하세요, 맹고 진행자예요." },
    { who: "해설자", text: "저는 해설자예요. 관심 있는 주제를 모아서 묻고 답하며 요약해 드릴게요." },
  ],
};

/** 만들어 둘 샘플: 지금 말투(아나운서)의 여성·남성 목소리 */
export const SAMPLES: { persona: Persona; vk: VoiceKey }[] = [
  { persona: "announcer", vk: "f" },
  { persona: "announcer", vk: "m" },
];

export function samplePath(persona: Persona, vk: VoiceKey): string {
  return `/voice-samples/${persona}-${vk}.mp3`;
}

export function sampleUrl(persona: Persona, voice: Voice): string {
  return samplePath(persona, voiceKey(persona, voice));
}
