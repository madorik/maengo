import type { Persona, Voice } from "@maengo/core/types";

const PERSONAS: Persona[] = ["announcer", "teacher", "dialogue"];
const VOICES: Voice[] = ["f", "m"];

export function parseEpisodeParams(search: URLSearchParams): { persona: Persona; voice: Voice } | null {
  const persona = search.get("persona") as Persona;
  const voice = (search.get("voice") ?? "f") as Voice;
  return PERSONAS.includes(persona) && VOICES.includes(voice) ? { persona, voice } : null;
}
