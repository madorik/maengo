import { addDays, kstDate } from '@maengo/core/kst';
import { check, db } from './lib/db';
import { pushToUser, type UserPushResult } from './lib/push';
import { kstDayRange, TRIAL_PENDING_STALE_MS, trialEndMessage, trialMayStart, trialNextStep } from './lib/trial';

// 무료 체험 끝 알림(2026-10-18). 서버 스케줄러 trial_reminder 작업이 하루 한 번(12:00 KST) 부른다(마이그레이션 20261018192200).
// 체험 중(subscriptions.status = 'trial')이고 해지하지 않아(cancel_at_period_end = false) 내일(KST) 첫 결제가 되는 사람에게 푸시 한 번.
// 체험은 계정당 한 번이라 trial_reminders(사람마다 한 줄)로 한 번만 보낸다. 알림을 꺼 둔 사람은 보내지 않는다.
// 결제 금액은 체험 동의 때 보여 준 스토어 표시 금액(trial_consents.price, 마지막 것).
//
// 가져가기: 보내기 전에 '보내는 중' 줄(result 없음, sent_at = 가져간 시각)을 먼저 넣은 쪽만 보낸다(두 실행이 겹쳐도 한 번).
// 전엔 가져간 뒤 실행이 300초에 끊기면 그 사람은 영영 알림을 못 받았다(2026-10-18 점검). 그래서
//   - 마감(스케줄러 예산)까지 한 번 보낼 시간이 있을 때만 새로 가져가고, 다시 보낼 시간이 없으면 놓아준다(lib/trial.ts)
//   - 다 못 했으면(시간이 모자람, 다른 실행이 보내는 중) unfinished로 알려 스케줄러가 작업을 놓아주고 다음 실행(5분 뒤)이 잇는다
//   - 실행이 끊겨 '보내는 중'으로 10분 넘게 남은 줄은 다음 실행이 넘겨받아 보낸다
// 같은 사람에게 두 번 가는 경우는 FCM이 받은 뒤 결과를 적기 전에 서버가 죽었을 때뿐이다(시간이 남을 때만 보내서 300초에 끊기지 않는다).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** trial_reminders 한 줄. result가 없으면 '보내는 중'(sent_at = 가져간 시각) */
type ReminderRow = { user_id: string; result: string | null; sent_at: string };

export interface TrialReminderRun {
  stats: {
    due: number;
    sent: number;
    muted: number;
    noDevice: number;
    failed: number;
    /** 이미 결과가 있는 사람(보냈거나 보낼 수 없었다) */
    already: number;
    /** 다른 실행이 보내는 중이라 이번엔 건너뛴 사람(끊긴 실행이면 10분 뒤 넘겨받는다) */
    busy: number;
    /** 시간이 모자라 다음 실행으로 넘긴 사람 */
    later: number;
  };
  /** 다 못 했다: 스케줄러가 작업을 성공으로 적지 않고 놓아줘 다음 실행이 잇는다 */
  unfinished: boolean;
}

/**
 * 이 사람을 가져간다. 가져갔으면 가져간 시각(ISO, 결과를 적거나 놓아줄 때 내 줄인지 확인한다), 못 가져갔으면 null.
 * 줄이 없으면 넣고(그사이 다른 실행이 넣었으면 안 들어간다), '보내는 중'으로 오래 남은 줄은 조건을 건 update 한 번으로 넘겨받는다
 */
async function claim(userId: string, trialEnd: string, row: ReminderRow | undefined): Promise<string | null> {
  const at = new Date().toISOString();
  if (!row) {
    const got = check(
      await db.from('trial_reminders').upsert({ user_id: userId, trial_end: trialEnd, sent_at: at, result: null }, { onConflict: 'user_id', ignoreDuplicates: true }).select('user_id'),
      'trial_reminders claim',
    ) as unknown[];
    return got.length ? at : null;
  }
  const stale = new Date(Date.now() - TRIAL_PENDING_STALE_MS).toISOString();
  const got = check(
    await db.from('trial_reminders').update({ trial_end: trialEnd, sent_at: at }).eq('user_id', userId).is('result', null).lt('sent_at', stale).select('user_id'),
    'trial_reminders takeover',
  ) as unknown[];
  return got.length ? at : null;
}

/** 보낼 시간이 없어 놓아준다(다음 실행이 다시 가져간다). 못 지우면 10분 뒤 넘겨받는다 */
async function release(userId: string, at: string) {
  const { error } = await db.from('trial_reminders').delete().eq('user_id', userId).eq('sent_at', at).is('result', null);
  if (error) console.error('[trial-reminder] 놓아주기', error.message);
}

/** 결과를 적는다. 못 적으면 '보내는 중'으로 남아 10분 뒤 다시 갈 수 있어 몇 번 더 해 본다 */
async function record(userId: string, at: string, result: string) {
  for (const wait of [0, 1_000, 3_000]) {
    if (wait) await sleep(wait);
    const { error } = await db
      .from('trial_reminders')
      .update({ result: result.slice(0, 200), sent_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('sent_at', at)
      .is('result', null);
    if (!error) return;
    console.error('[trial-reminder] 결과 기록', error.message);
  }
}

/** deadline(ms): 이 시각까지 끝낸다(서버 스케줄러의 예산. 함수는 그 뒤 1분 안에 끊긴다) */
export async function remindTrialEnding(now = new Date(), deadline = now.getTime() + 240_000): Promise<TrialReminderRun> {
  const { from, to } = kstDayRange(addDays(kstDate(now), 1));
  const subs = check(
    await db.from('subscriptions').select('user_id,current_period_end').eq('status', 'trial').eq('cancel_at_period_end', false).gte('current_period_end', from).lt('current_period_end', to),
    'subscriptions trial',
  ) as { user_id: string; current_period_end: string }[];
  const stats: TrialReminderRun['stats'] = { due: subs.length, sent: 0, muted: 0, noDevice: 0, failed: 0, already: 0, busy: 0, later: 0 };
  if (!subs.length) return { stats, unfinished: false };
  const rows = new Map(
    (check(await db.from('trial_reminders').select('user_id,result,sent_at').in('user_id', subs.map((s) => s.user_id)), 'trial_reminders') as ReminderRow[]).map((r) => [r.user_id, r]),
  );
  const todo = subs.filter((s) => rows.get(s.user_id)?.result == null);
  stats.already = subs.length - todo.length;
  if (todo.length) {
    const ids = todo.map((s) => s.user_id);
    const pushOn = new Set((check(await db.from('profiles').select('id').in('id', ids).eq('push_enabled', true), 'profiles push_enabled') as { id: string }[]).map((p) => p.id));
    const consents = check(await db.from('trial_consents').select('user_id,price,at').in('user_id', ids).order('at', { ascending: false }), 'trial_consents') as { user_id: string; price: string }[];
    const priceOf = new Map<string, string>();
    for (const c of consents) if (!priceOf.has(c.user_id)) priceOf.set(c.user_id, c.price);

    for (const [i, s] of todo.entries()) {
      // 한 번 보낼 시간도 없으면 남은 사람은 다음 실행에
      if (!trialMayStart(Date.now(), deadline)) {
        stats.later += todo.length - i;
        break;
      }
      const at = await claim(s.user_id, s.current_period_end, rows.get(s.user_id));
      if (!at) {
        stats.busy++;
        continue;
      }
      let result: UserPushResult | { status: 'muted' } = { status: 'muted' };
      let later = false;
      if (pushOn.has(s.user_id)) {
        const msg = trialEndMessage(s.current_period_end, priceOf.get(s.user_id) ?? null);
        for (let retries = 0; ; retries++) {
          try {
            result = await pushToUser(s.user_id, msg);
          } catch (e) {
            // 기기 토큰을 못 읽는 등 예상 못 한 실패도 잠깐의 실패로 본다
            result = { status: 'retry', note: String((e as Error).message ?? e).slice(0, 160) };
          }
          const step = trialNextStep(result.status, retries, Date.now(), deadline);
          if (step.do === 'done') break;
          if (step.do === 'later') {
            later = true;
            break;
          }
          await sleep(step.ms);
        }
      }
      if (later) {
        // 잠깐 실패했는데 다시 보낼 시간이 없다: 아무 기기에도 안 갔으니 놓아주고 다음 실행이 처음부터
        stats.later++;
        await release(s.user_id, at);
        continue;
      }
      if (result.status === 'sent') stats.sent++;
      else if (result.status === 'muted') stats.muted++;
      else if (result.status === 'no_device') stats.noDevice++;
      else stats.failed++;
      await record(s.user_id, at, 'note' in result ? `${result.status}: ${result.note}` : result.status);
    }
  }
  const unfinished = stats.busy > 0 || stats.later > 0;
  if (stats.due) console.log('[trial-reminder]', JSON.stringify({ ...stats, unfinished }));
  return { stats, unfinished };
}
