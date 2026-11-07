// 로그인 없이 둘러보기(/try)에 늘 나오는 소식(2026-11-07 사용자 결정: 매일 새로 고르지 않고 하나로 고정해 늘 똑같이 보인다).
// 소식(묶음 id)과 그 소식의 이미 만든 음성(audio_segments.key, 여성 아나운서)을 같이 고정한다. 이 순서대로 나온다.
// 요약된 소식과 음성은 지우지 않아서(맹고-문서/데이터-보존-정책.md) 계속 나온다. 처음 고정한 목록은 그날 운영 /try에 나오던 10개.
// 바꾸려면 묶음 id와 그 소식의 음성 키를 같이 바꾼다(음성 키는 audio_segments에서 그 cluster_id의 key).

export interface TryItemRef {
  clusterId: number;
  audioKey: string;
}

export const TRY_ITEMS: readonly TryItemRef[] = [
  { clusterId: 20545, audioKey: 'announcer-f-0897efa20b496a893672965e' }, // 코스피·코스닥 매도 사이드카 발동
  { clusterId: 20320, audioKey: 'announcer-f-110dbeb54da804aa6bedfd5f' }, // OpenSSH 10.6p2 출시
  { clusterId: 20434, audioKey: 'announcer-f-31daa11d90c84b95d8179325' }, // 미국 중간선거 뒤 AI 데이터센터 규제 우려
  { clusterId: 20206, audioKey: 'announcer-f-293fe284758d88f45a9d5b1b' }, // 오라클 AI 칩 포트폴리오 확장
  { clusterId: 20109, audioKey: 'announcer-f-f4e1e2ba8b2affcc2ebba0a7' }, // 코스피 5,500선 붕괴·사이드카
  { clusterId: 19986, audioKey: 'announcer-f-a0b711b106b655f4cc1a3034' }, // 금융권 37개사 정보 유출
  { clusterId: 19842, audioKey: 'announcer-f-b8bee2a55b0b9cdafe9d32eb' }, // 코인베이스 AI 보안 강화
  { clusterId: 19777, audioKey: 'announcer-f-3487b6ac9d71aa57a540826e' }, // PHP2Shell 취약점
  { clusterId: 19771, audioKey: 'announcer-f-940dd0dcb9ac94034251816b' }, // InfoQ 2026 AI·데이터 전망
  { clusterId: 19742, audioKey: 'announcer-f-7d77177f2e031fe7b295a5f9' }, // Gemini 유료 구독자 채팅 학습 활용
];

const KEYS = new Set(TRY_ITEMS.map((t) => t.audioKey));

/** 둘러보기 음성 키인지(/api/try/audio가 이 키만 내준다) */
export const isTryAudioKey = (key: string): boolean => KEYS.has(key);
