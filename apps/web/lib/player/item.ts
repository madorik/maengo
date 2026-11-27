import type { Persona, Voice } from "@maengo/core/types";
import { withBase } from "@/lib/base-path";

/**
 * 소리를 내기 시작한 쪽이 알리는 이벤트. 글 하나 듣기(useItemAudio)는 그 소식 번호를, 오늘 브리핑 플레이어는 -1을 보낸다.
 * 받은 글 하나 듣기는 자기 소식이 아니면 멈춘다(두 소리가 겹치지 않게)
 */
export const ITEM_PLAY_EVENT = "maengo:item-play";

/**
 * 오늘 듣기 맨 앞 챕터인 브리핑(오늘의 인사이트 핵심 요약을 읽는 음성, 2026-11-27 사용자: 브리핑부터 듣고 자연스럽게 다음 뉴스로)의 번호.
 * 소식 번호는 1부터라 겹치지 않는다. 소식 하나짜리 주소(itemQuery)에 이 번호를 넣으면 서버가 지금 브리핑의 음성을 준다(lib/server/episode.ts)
 */
export const BRIEFING_ID = 0;

export function itemQuery(clusterId: number, persona: Persona, voice: Voice): string {
  return `id=${clusterId}&persona=${persona}&voice=${voice}`;
}

/** 소식 하나짜리 음성 파일. 음성이 없으면 이 요청에서 그 소식 하나만 만든다 */
export function itemAudioUrl(query: string): string {
  return withBase(`/api/episode/item/audio?${query}`);
}

/**
 * 소식 하나짜리 음성을 미리 만들어 달라고 할 때(전체 듣기에서 다음 소식 하나만). 파일 주소는 주지 않고 204만 온다.
 * Free의 오늘 듣기 몫을 쓰지 않는다(몫은 실제로 들으려고 파일을 열 때 쓴다, 2026-11-09)
 */
export function itemWarmUrl(query: string): string {
  return withBase(`/api/episode/item/audio?${query}&warm=1`);
}

/** 소식 하나짜리 대본 시각표. 파일이 열린 뒤 부르면 실제 시각이 온다 */
export function itemInfoUrl(query: string): string {
  return withBase(`/api/episode/item?${query}`);
}
