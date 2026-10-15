import type { Voice } from "@maengo/core/types";

// 보관함 플레이리스트(고른 소식을 고른 순서대로 이어 듣기, Premium). 화면과 서버가 같이 쓴다.
// 파일 주소가 고른 소식·목소리만으로 정해져서, 재생을 누르는 순간(탭 안에서) 주소를 걸고 play()를 부를 수 있다.

/**
 * 음성 파일 하나로 이어 붙이는 소식 수. 플레이리스트·골라 듣기는 개수 제한이 없고(2026-10-15 사용자 결정),
 * 들을 때 이만큼씩 나눠 한 묶음이 끝나면 다음 묶음을 이어 튼다(PlayerProvider.playPlaylist)
 */
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
