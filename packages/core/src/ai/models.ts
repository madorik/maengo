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
  /** 음성(Google Cloud TTS 키가 없을 때만). 입력 $0.50 / 오디오 출력 $6(2027-01-01부터 $1 / $12) */
  tts: 'gemini-3.8-flash-lite-tts',
  /** 임베딩. 입력 $0.15 */
  embed: 'gemini-embedding-001',
} as const;
