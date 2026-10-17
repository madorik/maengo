import 'server-only';
import { kstDate } from '@maengo/core/kst';
import { db, must } from './db';

// 관리자 화면 맨 위 빨간 줄: Gemini가 막혔는지(크레딧 소진 표시, 하루 지출 상한. 파이프라인 lib/ai-guard.ts와 같은 기준),
// 결제 웹훅을 처리하지 못했는지(app/api/billing/revenuecat).

const FLAG = 'gemini_blocked';
const BILLING_FLAG = 'billing_webhook_failed';
/** 결제 웹훅 실패는 마지막 실패에서 하루 동안 보인다 */
const BILLING_FLAG_MS = 24 * 60 * 60 * 1000;

const kstTime = (d: Date) => d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * 결제 웹훅을 처리하지 못했을 때 남긴다. RevenueCat이 다시 보내지만 계속 실패하면 돈을 낸 사람이 Premium·맹고를 못 받는다.
 * 기록하다 실패해도 웹훅 응답은 그대로 둔다
 */
export async function flagBillingWebhookFailure(note: string, now = new Date()): Promise<void> {
  const until = new Date(now.getTime() + BILLING_FLAG_MS).toISOString();
  const { error } = await db.from('service_flags').upsert({ key: BILLING_FLAG, until, note: `${kstTime(now)} ${note}`.slice(0, 300) }, { onConflict: 'key' });
  if (error) console.error('service_flags billing_webhook_failed', error.message);
}

export interface AdminAlert {
  title: string;
  detail: string;
}

export async function adminAlerts(now = new Date()): Promise<AdminAlert[]> {
  const out: AdminAlert[] = [];
  const flags = must(await db.from('service_flags').select('key,until,note').in('key', [FLAG, BILLING_FLAG]), 'service_flags') as { key: string; until: string | null; note: string | null }[];
  const live = (key: string) => flags.find((f) => f.key === key && f.until && Date.parse(f.until) > now.getTime());
  const billing = live(BILLING_FLAG);
  if (billing) {
    out.push({
      title: '결제 웹훅을 처리하지 못했어요',
      detail: `마지막 실패 ${billing.note ?? ''}. RevenueCat이 다시 보내지만, 계속 뜨면 Vercel 로그와 RevenueCat 대시보드(Integrations > Webhooks)를 보세요. 하루 동안 실패가 없으면 사라져요.`,
    });
  }
  const flag = live(FLAG);
  if (flag?.until) {
    const until = new Date(flag.until).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });
    out.push({
      title: 'Gemini 선불 크레딧이 바닥났어요',
      detail: `요약·임베딩이 멈춰 새 소식이 안 만들어져요. AI Studio에서 충전하세요. ${until}에 다시 해 봐요.`,
    });
  }
  const cap = Number(process.env.GEMINI_DAILY_USD_CAP?.trim() || 1);
  const rows = must(await db.from('usage_log').select('est_usd').eq('provider', 'gemini').gte('at', `${kstDate(now)}T00:00:00+09:00`), 'usage_log today') as { est_usd: number | string }[];
  const spent = rows.reduce((n, r) => n + Number(r.est_usd), 0);
  if (spent >= cap) {
    out.push({
      title: `오늘 Gemini 지출이 상한 $${cap}에 닿았어요`,
      detail: `오늘 추정 $${spent.toFixed(2)}. 자정(한국 시간)까지 요약·임베딩을 멈추고 이미 요약된 소식으로만 피드를 만들어요. 상한은 GEMINI_DAILY_USD_CAP.`,
    });
  }
  return out;
}
