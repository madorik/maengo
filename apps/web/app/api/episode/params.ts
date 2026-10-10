import { PERSONA } from "@maengo/core/audio";
import type { Persona, Voice } from "@maengo/core/types";

const VOICES: Voice[] = ["f", "m"];

/** 말투는 아나운서 하나로 고정한다(예전 화면이 다른 말투를 보내도 아나운서로 만든다. 소식마다 음성은 여·남 2개까지) */
export function parseEpisodeParams(search: URLSearchParams): { persona: Persona; voice: Voice } | null {
  const voice = (search.get("voice") ?? "f") as Voice;
  return VOICES.includes(voice) ? { persona: PERSONA, voice } : null;
}
