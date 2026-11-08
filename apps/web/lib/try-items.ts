// 로그인 없이 둘러보기(/try)에 늘 나오는 소식(2026-11-07 사용자 결정: 매일 새로 고르지 않고 하나로 고정해 늘 똑같이 보인다).
// 소식(묶음 id)과 그 소식의 이미 만든 음성(audio_segments.key, 여성 아나운서)을 같이 고정한다. 이 순서대로 나온다.
// 요약된 소식과 음성은 지우지 않아서(맹고-문서/데이터-보존-정책.md) 계속 나온다.
// 처음 고정한 목록은 그날 운영 /try에 나오던 10개. 5번(코스피 5,500선 붕괴·사이드카)이 1번과 같은 사건이라 카카오 실적으로 바꿈(2026-11-07 사용자).
// 모두 11월에 만든 Premium 여성 음성(목소리 통일)
// 바꾸려면 묶음 id와 그 소식의 음성 키를 같이 바꾼다(음성 키는 audio_segments에서 그 cluster_id의 key).
// 2026-11-08 사용자: 10개 중 3개를 내 관심 링크 유튜브 채널 요약으로(2·8·9번, 개발자용 OpenSSH 출시·PHP2Shell 취약점·InfoQ 전망을 뺌).
// 운영 계정이 넣은 채널(슈카월드·리뷰엉이·아영이네 행복주택)의 영상이라 link: true로 내 관심 링크 글도 보여 준다

export interface TryItemRef {
  clusterId: number;
  audioKey: string;
  /** 내 관심 링크(사용자가 넣은 출처) 글뿐인 소식도 보여 준다(공개 출처 글이 없어도) */
  link?: true;
}

export const TRY_ITEMS: readonly TryItemRef[] = [
  { clusterId: 20545, audioKey: 'announcer-f-0897efa20b496a893672965e' }, // 경제·주식 · 코스피·코스닥 매도 사이드카 발동
  { clusterId: 21334, audioKey: 'announcer-f-c01eb8809a835c1b5cea48c0', link: true }, // 유튜브 슈카월드 · 아이폰 듀오 결함 논란에도 애플 시가총액 1위
  { clusterId: 20434, audioKey: 'announcer-f-31daa11d90c84b95d8179325' }, // 경제·주식 · 미국 중간선거 뒤 AI 데이터센터 규제 우려
  { clusterId: 20206, audioKey: 'announcer-f-293fe284758d88f45a9d5b1b' }, // Tech · 오라클 AI 칩 포트폴리오 확장
  { clusterId: 19924, audioKey: 'announcer-f-6837130950c540b0743717dc' }, // 비즈니스 · 카카오 3분기 실적·AI 비서 예고
  { clusterId: 19986, audioKey: 'announcer-f-a0b711b106b655f4cc1a3034' }, // 사회 · 금융권 37개사 정보 유출
  { clusterId: 19842, audioKey: 'announcer-f-b8bee2a55b0b9cdafe9d32eb' }, // 코인 · 코인베이스 AI 보안 강화
  { clusterId: 21336, audioKey: 'announcer-f-f5ea80fa056464a5dfc078ea', link: true }, // 유튜브 리뷰엉이 · 테슬라의 혁신 비결 '알고리즘' 경영
  { clusterId: 21337, audioKey: 'announcer-f-fd5690ec5bd8359f4e0b2546', link: true }, // 유튜브 아영이네 행복주택 · LH 공공임대주택 93만 호 면적 랭킹
  { clusterId: 19742, audioKey: 'announcer-f-7d77177f2e031fe7b295a5f9' }, // AI · Gemini 유료 구독자 채팅 학습 활용
];

const KEYS = new Set(TRY_ITEMS.map((t) => t.audioKey));

/** 둘러보기 음성 키인지(/api/try/audio가 이 키만 내준다) */
export const isTryAudioKey = (key: string): boolean => KEYS.has(key);
