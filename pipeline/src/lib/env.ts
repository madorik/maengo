import { GEMINI_MODELS } from '@maengo/core/ai';
// 로컬은 apps/web/.env.local을, GitHub Actions는 저장소 시크릿을 읽는다(package.json의 --env-file-if-exists).

function required(name: string, ...alts: string[]): string {
  for (const key of [name, ...alts]) {
    const v = process.env[key]?.trim();
    if (v) return v;
  }
  throw new Error(`환경 변수 ${name}이(가) 없어요`);
}

const num = (name: string, fallback: number) => {
  const raw = process.env[name]?.trim();
  const v = Number(raw);
  return raw && Number.isFinite(v) && v >= 0 ? v : fallback;
};

export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  geminiKey: required('GEMINI_API_KEY'),
  /** 503이 계속될 때 대신 쓸 모델(고정 버전, core/ai/models.ts) */
  geminiFallback: GEMINI_MODELS.fallback,
  /** 한 번 실행에서 요약할 클러스터 수 상한(무료 등급 하루 요청 한도를 지키려고) */
  summarizeLimit: num('PIPELINE_SUMMARIZE_LIMIT', 40),
  /** 하루(KST) Gemini 추정 지출 상한(달러). 넘으면 그날 요약·임베딩을 멈춘다(lib/ai-guard.ts) */
  geminiDailyCapUsd: num('GEMINI_DAILY_USD_CAP', 1),
  /** 한 번 실행에서 요약할 영상 수 상한(영상은 토큰이 많이 든다) */
  videoLimit: num('PIPELINE_VIDEO_LIMIT', 2),
  maxVideoMinutes: num('PIPELINE_MAX_VIDEO_MINUTES', 20),
  /** 알림을 눌렀을 때 열 사이트 주소(웹 푸시 링크) */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://maengo.vercel.app',
};
