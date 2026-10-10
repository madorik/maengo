"use client";

import { PERSONA_BY_ID } from "@maengo/core/audio";
import { PersonaPicker, VoicePicker } from "@/components/listen/controls";
import { usePlayer } from "@/components/providers/PlayerProvider";

/**
 * 설정 > 듣기: 기본 말투(아나운서·선생님·대담)와 목소리. 고르면 바로 저장되고(profiles.persona·voice),
 * 오늘 전체 듣기와 글 하나 듣기가 모두 이 말투로 시작한다. 듣는 중에 듣기 창에서 바꾼 것도 같은 값이다.
 */
export function ListenPrefs({ audio }: { audio: boolean }) {
  const p = usePlayer();
  const voice = p.persona === "dialogue" ? "진행자·해설자 두 목소리" : p.voice === "f" ? "여성 목소리" : "남성 목소리";
  return (
    <>
      <p className="text-sub">듣기를 누르면 고른 말투로 읽어 드려요. 듣는 중에도 듣기 창에서 바꿀 수 있어요.</p>
      <PersonaPicker />
      <VoicePicker />
      <p aria-live="polite" className="mt-3 text-[14px] font-bold text-leaf">
        지금 기본값: {PERSONA_BY_ID[p.persona].name} 말투, {voice}
      </p>
      {!audio && <p className="mt-1 text-[13px] text-sub">듣기는 Premium에서 쓸 수 있어요. 말투는 미리 골라 둘 수 있어요.</p>}
    </>
  );
}
