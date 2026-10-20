import 'server-only';
import { kstDate } from '@maengo/core/kst';
import { db, must } from './db';

// 음성 사용 기록과 서비스 전체 TTS 한도. Premium 듣기는 사람별 횟수 제한이 없다.
// 새 음성을 만들면 usage_log(user_id, kind='voice')에 기록만 한다(비용 추적용)
// '오늘 소식 받기'(즉석 피드, kind='instant')와 '남은 소식 더 받기'(kind='fill')는 한 사람이 하루에 부를 수 있는 횟수를 이 기록으로 센다(app/api/feed/today, …/fill)

export type UsageKindForLimit = 'voice' | 'instant' | 'fill';

export async function recordUse(userId: string, kind: UsageKindForLimit) {
  const { error } = await db.from('usage_log').insert({ provider: 'maengo', kind, user_id: userId, units: 1, est_usd: 0 });
  if (error) console.error('usage_log insert', error.message);
}

/** 오늘(KST 0시부터) 이 사람이 kind를 쓴 횟수 */
export async function usesToday(userId: string, kind: UsageKindForLimit): Promise<number> {
  const since = new Date(`${kstDate()}T00:00:00+09:00`).toISOString();
  const { count, error } = await db.from('usage_log').select('id', { count: 'exact', head: true }).eq('provider', 'maengo').eq('kind', kind).eq('user_id', userId).gte('at', since);
  if (error) throw new Error(`usage_log: ${error.message}`);
  return count ?? 0;
}

/** 서비스 전체의 TTS 한도(Gemini 무료 등급 하루 요청 수)가 찼다. until까지 TTS를 부르지 않는다 */
export class TtsBusyError extends Error {
  constructor(readonly until: Date) {
    super('음성 서비스 한도가 찼어요');
    this.name = 'TtsBusyError';
  }
}

export async function ttsBlockedUntil(): Promise<Date | null> {
  const row = must(await db.from('service_flags').select('until').eq('key', 'tts_quota').maybeSingle(), 'service_flags') as { until: string | null } | null;
  if (!row?.until) return null;
  const until = new Date(row.until);
  return until.getTime() > Date.now() ? until : null;
}

/** Gemini가 하루 한도를 알리면 한 시간 동안 TTS를 부르지 않는다(풀렸는지는 한 시간 뒤 다시 본다) */
export async function blockTts(minutes = 60) {
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  const { error } = await db.from('service_flags').upsert({ key: 'tts_quota', until, note: 'Gemini TTS 하루 한도' }, { onConflict: 'key' });
  if (error) console.error('service_flags', error.message);
}

