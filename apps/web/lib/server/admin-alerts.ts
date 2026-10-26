import 'server-only';
import { addDays, kstDate } from '@maengo/core/kst';
import { type AdminAlert, opsAlerts, type TaskState } from '../admin-ops';
import { db, must } from './db';
import { openInquiries, unsentInquiries } from './inquiry';

// 관리자 화면 알림(위 막대의 종, components/admin/AlertBell.tsx): Gemini가 막혔는지(크레딧 소진 표시, 하루 지출 상한. 파이프라인 lib/ai-guard.ts와 같은 기준),
// 결제 웹훅을 처리하지 못했는지(app/api/billing/revenuecat), 배송·수집이 멈췄거나 실패가 몰렸는지(판단은 lib/admin-ops.ts).

export type { AdminAlert };

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
  // 답장 기다리는 문의(관리자 > 운영 탭 아래 문의에서 답장)
  const waiting = await openInquiries().catch(() => 0);
  if (waiting > 0) out.push({ title: `답장을 기다리는 문의가 ${waiting}건 있어요`, detail: '문의 탭에서 AI 초안을 보고 보내면 돼요.', href: '/admin?tab=inquiries' });
  // 문의하기 양식은 DB에 남았지만 운영자 메일로 가지 않은 것(RESEND_API_KEY 없음·도메인 인증 전·Resend 실패)
  const unsent = await unsentInquiries(now).catch(() => 0);
  if (unsent > 0) {
    out.push({
      title: `메일로 보내지 못한 문의가 ${unsent}건 있어요`,
      detail: '최근 7일. 내용과 답장 주소는 문의 탭에 있어요(\'운영자 메일 못 감\'). RESEND_API_KEY와 Resend 도메인 인증을 확인하세요.',
      href: '/admin?tab=inquiries',
    });
  }
  out.push(...(await opsState(now)));
  return out;
}

/** 배송(1분)·수집(06:00) 작업 상태와 오늘·지난 7일 배송 결과 수 */
async function opsState(now: Date): Promise<AdminAlert[]> {
  const today = kstDate(now);
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>, what: string) => {
    const { count: n, error } = await q;
    if (error) throw new Error(`${what}: ${error.message}`);
    return n ?? 0;
  };
  const jobs = () => db.from('delivery_jobs').select('user_id', { count: 'exact', head: true });
  const [tasks, total, failed, noDevice, noDeviceWeek] = await Promise.all([
    db.from('scheduler_tasks').select('name,enabled,next_run_at,running_since,last_finished_at,last_status,last_error,last_stats').in('name', ['deliveries', 'ingest']),
    count(jobs().eq('date', today), 'delivery_jobs today'),
    count(jobs().eq('date', today).eq('status', 'failed'), 'delivery_jobs failed'),
    count(jobs().eq('date', today).eq('status', 'no_device'), 'delivery_jobs no_device'),
    count(jobs().gte('date', addDays(today, -7)).lt('date', today).eq('status', 'no_device'), 'delivery_jobs no_device week'),
  ]);
  type Row = { name: string; enabled: boolean; next_run_at: string | null; running_since: string | null; last_finished_at: string | null; last_status: string | null; last_error: string | null; last_stats: TaskState['lastStats'] };
  const rows = must(tasks, 'scheduler_tasks') as Row[];
  const state = (name: string): TaskState | null => {
    const r = rows.find((x) => x.name === name);
    return r
      ? { enabled: r.enabled, nextRunAt: r.next_run_at, runningSince: r.running_since, lastFinishedAt: r.last_finished_at, lastStatus: r.last_status, lastError: r.last_error, lastStats: r.last_stats }
      : null;
  };
  return opsAlerts({ now, deliveries: state('deliveries'), ingest: state('ingest'), today: { total, failed, noDevice }, noDeviceAvg: noDeviceWeek / 7 });
}
