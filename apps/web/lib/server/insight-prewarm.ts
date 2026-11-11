import 'server-only';
import { addDays, kstDate } from '@maengo/core/kst';
import { INSIGHT_VERSION, briefingInsight } from './briefing-insight';
import { db } from './db';
import { getTodayData } from './feed';
import { loadProfile } from './profile';
import { getUserContext } from './user-context';

// 오늘의 흐름 미리 만들기(2026-11-11 사용자: 성능 1번 — 매일 처음 열 때 인사이트 자리가 몇 초 회색).
// 배송(1분마다, app/api/cron/deliveries)이 오늘 브리핑을 만든 사람의 오늘의 흐름을 그 자리에서 만들어 둔다. 열면 바로 보인다.
// 최근 3일 이상 접속하지 않은 사람은 만들지 않는다(사용자 결정: 안 볼 사람 몫의 Gemini 비용을 쓰지 않게). 그 사람은 열 때 만든다(지금과 같다).
// 한 번에 몇 명씩, 마감 안에서만. 못 한 사람은 다음 실행(1분 뒤)이 잇거나 열 때 만든다.

/** 이 날 이후 접속한 사람만(오늘·어제·그제). 그보다 오래 안 온 사람은 '3일 이상 접속 안 함' */
const ACTIVE_DAYS = 2;
/** 브리핑을 만든 지 이 시간 안의 사람만 본다(오래된 줄을 매번 다시 보지 않게) */
const RECENT_MS = 3 * 3600_000;
/** 한 실행에서 만드는 최대 인원·동시에 만드는 수 */
const MAX_PER_RUN = 12;
const PARALLEL = 3;
/** 한 사람 만드는 데 드는 시간(여유 포함). 마감까지 이보다 적게 남으면 그만둔다 */
const PER_USER_MS = 15_000;

const BUILT = ['ready', 'sending', 'sent', 'no_device'];

export async function prewarmInsights(deadline: number): Promise<{ candidates: number; made: number; skipped: number; failed: number }> {
  const out = { candidates: 0, made: 0, skipped: 0, failed: 0 };
  const date = kstDate();
  const { data: jobs, error } = await db
    .from('delivery_jobs')
    .select('user_id,slot')
    .eq('date', date)
    .in('status', BUILT)
    .gte('built_at', new Date(Date.now() - RECENT_MS).toISOString());
  if (error || !jobs?.length) return out;
  const rows = jobs as { user_id: string; slot: 'am' | 'pm' | null }[];
  const ids = [...new Set(rows.map((r) => r.user_id))];

  // 이미 새 형식으로 만든 사람, 최근 3일 이상 안 온 사람은 뺀다
  const [{ data: made }, { data: visits }] = await Promise.all([
    db.from('briefing_insights').select('user_id,slot,data->v').eq('date', date).in('user_id', ids),
    db.from('visits').select('user_id').in('user_id', ids).gte('date', addDays(date, -ACTIVE_DAYS)),
  ]);
  const fresh = new Set(((made ?? []) as { user_id: string; slot: string; v: number | null }[]).filter((m) => m.v === INSIGHT_VERSION).map((m) => `${m.user_id}|${m.slot}`));
  const active = new Set(((visits ?? []) as { user_id: string }[]).map((v) => v.user_id));
  const todo = rows.filter((r) => active.has(r.user_id) && !fresh.has(`${r.user_id}|${r.slot ?? 'am'}`)).slice(0, MAX_PER_RUN);
  out.candidates = todo.length;
  if (!todo.length) return out;

  let next = 0;
  const worker = async () => {
    while (next < todo.length && deadline - Date.now() > PER_USER_MS) {
      const job = todo[next++]!;
      try {
        const profile = await loadProfile(job.user_id, { provider: 'google', email: null, avatarUrl: null, demo: false });
        if (!profile) {
          out.skipped++;
          continue;
        }
        const data = await getTodayData(profile);
        // 지금 보여 줄 브리핑이 그 줄의 브리핑일 때만(오전 줄인데 이미 퇴근길 시간이면 열 때 만든다)
        if (data.slot !== (job.slot ?? 'am') || data.items.length < 2) {
          out.skipped++;
          continue;
        }
        const ctx = await getUserContext(profile.id).catch(() => ({}));
        if (await briefingInsight(profile, data, ctx)) out.made++;
        else out.failed++;
      } catch (e) {
        out.failed++;
        console.error('[insight-prewarm] 실패', job.user_id.slice(0, 8), String((e as Error)?.message ?? e).slice(0, 200));
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  console.log('[insight-prewarm]', JSON.stringify(out));
  return out;
}
