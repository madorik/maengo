import { PERSONA } from "@maengo/core/audio";
import type { Persona, Voice } from "@maengo/core/types";

const VOICES: Voice[] = ["f", "m"];

/** 오늘 듣기의 ?ids=3,1,2(플레이어에 남은 오늘 소식). 없으면 null(오늘 피드 전부, 예전 화면), 비어 있으면 빈 목록(다 뺐다) */
export function parseTodayIds(raw: string | null): number[] | null {
  if (raw === null) return null;
  return [...new Set(raw.split(",").filter(Boolean).map(Number))].filter((n) => Number.isInteger(n) && n > 0);
}

/** 말투는 아나운서 하나로 고정한다(예전 화면이 다른 말투를 보내도 아나운서로 만든다. 소식마다 음성은 여·남 2개까지) */
export function parseEpisodeParams(search: URLSearchParams): { persona: Persona; voice: Voice } | null {
  const voice = (search.get("voice") ?? "f") as Voice;
  return VOICES.includes(voice) ? { persona: PERSONA, voice } : null;
}
