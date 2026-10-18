// 오늘 글 하나(목록 카드·상세의 '듣기')를 오늘 플레이어로 들을지, 그 글 하나짜리 파일(useItemAudio)로 들을지.

export interface RouteState {
  /** 이 소식이 오늘 플레이어 목록(챕터)에 있는지 */
  inPlayer: boolean;
  /** 플레이리스트를 듣는 중인지(그동안 오늘 글은 글 하나로 듣는다) */
  playlist: boolean;
  /** 오늘 전체 음성이 이미 있는지 */
  audioReady: boolean;
  /** 플레이어가 돌고 있는지(재생·멈춤·다 들음·음성 기다림) */
  playerBusy: boolean;
  /** 이 글 하나 듣기를 시작했는지(singleStarted) */
  singleBusy: boolean;
}

/** 글 하나 듣기를 시작했는지(재생·멈춤·다 들음·음성 기다림). 시작 전·잠금이면 false */
export function singleStarted(ctl: { state: string; preparing?: boolean }): boolean {
  return ctl.state === "playing" || ctl.state === "paused" || ctl.state === "finished" || !!ctl.preparing;
}

/**
 * 플레이어 목록에 있고, 플레이어가 돌고 있거나 오늘 전체 음성이 이미 있으면 플레이어로.
 * 글 하나 듣기를 이미 시작했으면 플레이어가 시작되기 전까지 글 하나로 둔다: 에피소드 정보가 늦게 와 '전체 음성 있음'이 되어도
 * 듣던 소리가 끊기거나 다 들은 표시가 사라지지 않게(플레이어가 시작되면 플레이어가 이어받는다)
 */
export function viaTodayPlayer(s: RouteState): boolean {
  if (!s.inPlayer || s.playlist) return false;
  return s.playerBusy || (s.audioReady && !s.singleBusy);
}
