import { PERSONA_BY_ID } from "@maengo/core/audio";
import type { Persona } from "@maengo/core/types";

export function minutesLabel(ms: number | null): string {
  return ms === null ? "" : `약 ${Math.max(1, Math.round(ms / 60000))}분`;
}

export function personaName(p: Persona): string {
  return PERSONA_BY_ID[p].name;
}
