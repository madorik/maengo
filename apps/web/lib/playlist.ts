import type { Voice } from "@maengo/core/types";

// 보관함 플레이리스트(고른 소식을 고른 순서대로 이어 듣기, Premium). 화면과 서버가 같이 쓴다.
// 파일 주소가 고른 소식·목소리만으로 정해져서, 재생을 누르는 순간(탭 안에서) 주소를 걸고 play()를 부를 수 있다.

/** 한 번에 고를 수 있는 소식 수 */
export const PLAYLIST_MAX = 20;

export function playlistQuery(ids: number[], voice: Voice): string {
  return `ids=${ids.join(",")}&voice=${voice}`;
}

export function playlistAudioUrl(ids: number[], voice: Voice): string {
  return `/api/episode/playlist/audio?${playlistQuery(ids, voice)}`;
}

/** ?ids=3,1,2 → [3, 1, 2](중복·잘못된 값 빼고, 최대 PLAYLIST_MAX개). 없으면 null */
export function parsePlaylistIds(raw: string | null): number[] | null {
  const ids = [...new Set((raw ?? "").split(",").map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  return ids.length && ids.length <= PLAYLIST_MAX ? ids : null;
}
