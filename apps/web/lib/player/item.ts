import type { Persona, Voice } from "@maengo/core/types";
import { withBase } from "@/lib/base-path";

/**
 * 소리를 내기 시작한 쪽이 알리는 이벤트. 글 하나 듣기(useItemAudio)는 그 소식 번호를, 오늘 브리핑 플레이어는 -1을 보낸다.
 * 받은 글 하나 듣기는 자기 소식이 아니면 멈춘다(두 소리가 겹치지 않게)
 */
export const ITEM_PLAY_EVENT = "maengo:item-play";

export function itemQuery(clusterId: number, persona: Persona, voice: Voice): string {
  return `id=${clusterId}&persona=${persona}&voice=${voice}`;
}

/** 소식 하나짜리 음성 파일. 음성이 없으면 이 요청에서 그 소식 하나만 만든다 */
export function itemAudioUrl(query: string): string {
  return withBase(`/api/episode/item/audio?${query}`);
}

/** 소식 하나짜리 대본 시각표. 파일이 열린 뒤 부르면 실제 시각이 온다 */
export function itemInfoUrl(query: string): string {
  return withBase(`/api/episode/item?${query}`);
}
