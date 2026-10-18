import { addDays, kstDate } from '@maengo/core/kst';
import { check, db } from './lib/db';
import { pushToUser, type UserPushResult } from './lib/push';
import { kstDayRange, trialEndMessage } from './lib/trial';

// 무료 체험 끝 알림(2026-10-18). 서버 스케줄러 trial_reminder 작업이 하루 한 번(12:00 KST) 부른다(마이그레이션 20261018192200).
// 체험 중(subscriptions.status = 'trial')이고 해지하지 않아(cancel_at_period_end = false) 내일(KST) 첫 결제가 되는 사람에게 푸시 한 번.
// 체험은 계정당 한 번이라 trial_reminders(사람마다 한 줄)에 먼저 넣은 쪽만 보낸다(두 번 돌아도 한 번). 알림을 꺼 둔 사람은 보내지 않는다.
// 결제 금액은 체험 동의 때 보여 준 스토어 표시 금액(trial_consents.price, 마지막 것).

/** 잠깐의 실패(429·5xx)면 같은 실행에서 이만큼 기다렸다 다시 보낸다. 다음 실행은 내일이라 그때는 '내일'이 아니다 */
const RETRY_WAITS_MS = [3_000, 10_000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function remindTrialEnding(now = new Date()): Promise<Record<string, number>> {
  const { from, to } = kstDayRange(addDays(kstDate(now), 1));
  const subs = check(
    await db.from('subscriptions').select('user_id,current_period_end').eq('status', 'trial').eq('cancel_at_period_end', false).gte('current_period_end', from).lt('current_period_end', to),
    'subscriptions trial',
  ) as { user_id: string; current_period_end: string }[];
  const out = { due: subs.length, sent: 0, muted: 0, noDevice: 0, failed: 0, already: 0 };
  if (!subs.length) return out;
  const ids = subs.map((s) => s.user_id);
  const pushOn = new Set((check(await db.from('profiles').select('id').in('id', ids).eq('push_enabled', true), 'profiles push_enabled') as { id: string }[]).map((p) => p.id));
  const consents = check(await db.from('trial_consents').select('user_id,price,at').in('user_id', ids).order('at', { ascending: false }), 'trial_consents') as { user_id: string; price: string }[];
  const priceOf = new Map<string, string>();
  for (const c of consents) if (!priceOf.has(c.user_id)) priceOf.set(c.user_id, c.price);

  for (const s of subs) {
    // 먼저 한 줄을 넣는다: 이미 있으면(보냈거나 다른 실행이 보내는 중) 건너뛴다
    const claimed = check(
      await db.from('trial_reminders').upsert({ user_id: s.user_id, trial_end: s.current_period_end }, { onConflict: 'user_id', ignoreDuplicates: true }).select('user_id'),
      'trial_reminders claim',
    ) as { user_id: string }[];
    if (!claimed.length) {
      out.already++;
      continue;
    }
    let result: UserPushResult | { status: 'muted' } = { status: 'muted' };
    if (pushOn.has(s.user_id)) {
      try {
        const msg = trialEndMessage(s.current_period_end, priceOf.get(s.user_id) ?? null);
        result = await pushToUser(s.user_id, msg);
        for (const wait of RETRY_WAITS_MS) {
          if (result.status !== 'retry') break;
          await sleep(wait);
          result = await pushToUser(s.user_id, msg);
        }
      } catch (e) {
        result = { status: 'error', note: String((e as Error).message ?? e).slice(0, 160) };
      }
    }
    if (result.status === 'sent') out.sent++;
    else if (result.status === 'muted') out.muted++;
    else if (result.status === 'no_device') out.noDevice++;
    else out.failed++;
    const note = 'note' in result ? `${result.status}: ${result.note}` : result.status;
    const { error } = await db.from('trial_reminders').update({ result: note.slice(0, 200), sent_at: new Date().toISOString() }).eq('user_id', s.user_id);
    if (error) console.error('[trial-reminder] 결과 기록', error.message);
  }
  if (out.due) console.log('[trial-reminder]', JSON.stringify(out));
  return out;
}
