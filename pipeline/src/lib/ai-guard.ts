import { GeminiBlockedError, GeminiQuotaError, type GeminiAi } from '@maengo/core/gemini';
import { kstDate } from '@maengo/core/kst';
import { check, db } from './db';
import { env } from './env';

// Gemini 지출 지킴이(2026-10-14). 모든 파이프라인 AI 호출을 감싸서
// - 선불 크레딧이 바닥나면(402) 한 시간 동안 부르지 않는다(service_flags 'gemini_blocked'). 한 시간 뒤 한 번 다시 해 본다
// - 오늘(KST) 추정 지출이 상한(GEMINI_DAILY_USD_CAP, 기본 $1)을 넘으면 그날은 부르지 않는다
// 막히면 GeminiBlockedError(할당량 오류의 한 갈래)를 던지고, 부르는 쪽은 이미 요약된 소식으로 계속한다.
// 관리자 화면 알림 종에 같은 상태를 띄운다(apps/web/lib/server/admin-alerts.ts).

const FLAG = 'gemini_blocked';
const BLOCK_MINUTES = 60;
/** 막힘 확인을 이만큼 재사용한다(요약·임베딩 호출마다 DB를 읽지 않게) */
const CACHE_MS = 60_000;

/** 할당량·크레딧·상한 때문에 AI를 못 부른 오류인지 */
export const isAiBlocked = (e: unknown): boolean => e instanceof GeminiQuotaError;

/**
 * 오늘(KST) Gemini 추정 지출(usage_log, 호출마다 쌓인 값. lib/usage.ts). Premium 듣기 음성(kind 'tts', 웹)은 빼고 센다:
 * 음성이 많이 나가도 소식 요약이 멈추지 않게, 음성은 웹이 따로 상한을 둔다(apps/web lib/server/ai.ts, 2026-10-29)
 */
export async function geminiSpentToday(now = new Date()): Promise<number> {
  const since = `${kstDate(now)}T00:00:00+09:00`;
  const rows = check(await db.from('usage_log').select('est_usd').eq('provider', 'gemini').neq('kind', 'tts').gte('at', since), 'usage_log today') as { est_usd: number | string }[];
  return rows.reduce((n, r) => n + Number(r.est_usd), 0);
}

let cached: { at: number; reason: { kind: 'credits' | 'budget'; note: string } | null } | null = null;

/** 지금 AI를 부르면 안 되는 이유. 없으면 null */
export async function aiBlockedReason(now = new Date()): Promise<{ kind: 'credits' | 'budget'; note: string } | null> {
  if (cached && now.getTime() - cached.at < CACHE_MS) return cached.reason;
  let reason: { kind: 'credits' | 'budget'; note: string } | null = null;
  const flag = check(await db.from('service_flags').select('until,note').eq('key', FLAG).maybeSingle(), 'service_flags') as { until: string | null; note: string | null } | null;
  if (flag?.until && Date.parse(flag.until) > now.getTime()) reason = { kind: 'credits', note: flag.note ?? 'Gemini 크레딧 소진' };
  if (!reason) {
    const spent = await geminiSpentToday(now);
    if (spent >= env.geminiDailyCapUsd) reason = { kind: 'budget', note: `오늘 Gemini 지출 $${spent.toFixed(2)}가 상한 $${env.geminiDailyCapUsd}에 닿음` };
  }
  cached = { at: now.getTime(), reason };
  return reason;
}

/** 402를 받았다: 한 시간 동안 부르지 않게 표시한다 */
async function markCreditsBlocked(message: string) {
  const until = new Date(Date.now() + BLOCK_MINUTES * 60_000).toISOString();
  const { error } = await db.from('service_flags').upsert({ key: FLAG, until, note: `Gemini 선불 크레딧 소진(402): ${message.slice(0, 120)}` }, { onConflict: 'key' });
  if (error) console.error('service_flags gemini_blocked', error.message);
  cached = null;
}

/** AI 클라이언트의 모든 호출 앞뒤에 막힘 확인을 붙인다 */
export function guardAi(ai: GeminiAi): GeminiAi {
  return new Proxy(ai, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        const blocked = await aiBlockedReason();
        if (blocked) throw new GeminiBlockedError('guard', blocked.note, blocked.kind);
        try {
          return await (value as (...a: unknown[]) => unknown).apply(target, args);
        } catch (e) {
          if (e instanceof GeminiBlockedError && e.reason === 'credits') await markCreditsBlocked(e.message);
          throw e;
        }
      };
    },
  });
}
