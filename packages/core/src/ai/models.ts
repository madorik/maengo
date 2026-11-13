// Gemini 모델은 고정 버전만 쓴다(2026-10-14 사용자 결정: -latest 별칭과 Pro 모델은 쓰지 않고, 지금 쓸 수 있는 제일 싼 버전).
// 더 싼 gemini-2.5-flash-lite는 '새 사용자는 쓸 수 없음'(404)이라 못 쓴다(2026-10-14 확인).
// 모든 플랜이 같은 요약을 본다. 바꿀 때는 여기만 고치고 추정 단가(pipeline/src/lib/usage.ts, apps/web/lib/server/ai.ts)도 맞춘다.
// 단가(100만 토큰당, 2026-10-14 https://ai.google.dev/gemini-api/docs/pricing)는 각 줄에 적는다.
export const GEMINI_MODELS = {
  /** 요약(생각 최소, gemini.ts SUMMARY_THINKING). 입력 $0.25 / 출력 $1.50, 한 건 약 ₩3 */
  summary: 'gemini-3.1-flash-lite',
  /** 요약 모델이 혼잡(503·500)할 때 대신. 입력 $0.30 / 출력 $2.50 */
  fallback: 'gemini-3.5-flash-lite',
  /** 기타 관심사의 성인 관련어 검사. 입력 $0.25 / 출력 $1.50 */
  screen: 'gemini-3.1-flash-lite',
  /** 문의 답장 초안(문의 하나에 한 번). 입력 $0.25 / 출력 $1.50, 한 번 약 ₩2 */
  support: 'gemini-3.1-flash-lite',
  /** 글 화면의 맹고 AI 답·추천 질문의 대신 모델(OpenAI가 안 될 때, 기본은 OPENAI_MODELS.ask). 입력 $0.25 / 출력 $1.50, 한 번 약 ₩1 */
  ask: 'gemini-3.1-flash-lite',
  /** 주간·월간 리포트 정리(사람·기간마다 한 번, pipeline/src/reports.ts). 입력 $0.25 / 출력 $1.50, 주간 한 번 약 ₩4($0.003) */
  report: 'gemini-3.1-flash-lite',
  /** 오늘의 흐름의 대신 모델(OpenAI가 안 될 때: 키 없음·오류·처리방침 시행 전·AI_PROVIDER=gemini). 기본은 OPENAI_MODELS.insight. 입력 $0.25 / 출력 $1.50, 실측 한 번 약 $0.0052(약 ₩7, 11-13 15건 평균, 생각 토큰 포함) */
  insight: 'gemini-3.1-flash-lite',
  /** 음성(Google Cloud TTS 키가 없을 때만). 입력 $0.50 / 오디오 출력 $6(2027-01-01부터 $1 / $12) */
  tts: 'gemini-3.8-flash-lite-tts',
  /** 임베딩. 입력 $0.15 */
  embed: 'gemini-embedding-001',
} as const;

// OpenAI 모델(2026-11-13 사용자 결정 '오늘의 흐름을 gpt-6-luna로 바꾸자'). 운영자 계정 11-13 퇴근길로 Gemini 3.1 Flash-Lite·3.8 Flash·
// gpt-5.6-luna·gpt-5-mini·gpt-6.1-terra와 견줘 3.8 Flash 수준의 해석을 가장 싸게 냈다(맹고-문서/오늘의-흐름.md '모델 단가 검토').
// 단가(100만 토큰당, https://developers.openai.com/api/docs/pricing 2026-11-13). 생각(reasoning) 토큰은 출력 값으로 매긴다
export const OPENAI_MODELS = {
  /** 오늘의 흐름·맞춤 체크(apps/web/lib/server/briefing-insight.ts). 입력 $0.10 / 출력 $0.50, 실측 한 번 약 $0.0013(약 ₩2) */
  insight: 'gpt-6-luna',
  /** 글 화면의 맹고 AI 답(흘려 보내기)·추천 질문(2026-11-13 사용자 '질문하는 것도 GPT로 바꾸자', lib/server/ask.ts·ask-suggest.ts) */
  ask: 'gpt-6-luna',
} as const;

/** OpenAI 추정 단가(100만 토큰당 달러). 모델을 바꾸면 같이 고친다 */
export const OPENAI_PRICE: Record<string, { input: number; output: number }> = {
  'gpt-6-luna': { input: 0.1, output: 0.5 },
};
