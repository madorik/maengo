import { kstDate } from '@maengo/core/kst';

// 관리자 화면 알림(종) 중 운영(배송·수집) 판단. DB를 읽지 않는 계산만(테스트: __tests__/admin-ops.test.ts).
// 읽기는 lib/server/admin-alerts.ts. 관리자만 보는 화면이라 무엇을 볼지까지 적는다.

export interface AdminAlert {
  title: string;
  detail: string;
  /** 누르면 갈 관리자 화면(종 목록에서 링크로) */
  href?: string;
}

/** scheduler_tasks 한 줄에서 여기서 쓰는 칸 */
export interface TaskState {
  enabled: boolean;
  nextRunAt: string | null;
  runningSince: string | null;
  lastFinishedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  /** 실패했을 때 스케줄러가 남긴 기록(pipeline/src/lib/retry.ts TaskFailState) */
  lastStats: { fails?: unknown; retryAt?: unknown } | null;
}

export interface OpsInput {
  now: Date;
  deliveries: TaskState | null;
  ingest: TaskState | null;
  /** 오늘(KST) delivery_jobs 결과 */
  today: { total: number; failed: number; noDevice: number };
  /** 지난 7일(오늘 빼고) 하루 평균 '기기 없음' */
  noDeviceAvg: number;
}

/** 1분 배송이 이보다 오래 안 끝났으면 멈춘 것으로 본다 */
export const DELIVERY_STALE_MS = 5 * 60_000;
/** 수집(06:00)이 이 시각(KST)까지 오늘 성공하지 않았으면 알린다(가장 이른 알림이 07시) */
const INGEST_DUE_HOUR = 7;

const kstTime = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const kstHour = (d: Date) => new Date(d.getTime() + 9 * 3600_000).getUTCHours();
const ago = (ms: number) => (ms < 3600_000 ? `${Math.round(ms / 60_000)}분` : `${Math.floor(ms / 3600_000)}시간 ${Math.round((ms % 3600_000) / 60_000)}분`);

/** 실패가 평소보다 많은지: 실패는 2건 이상이면서 오늘 처리한 줄의 10% 이상, 기기 없음은 3건 이상이면서 지난 7일 평균의 2배 이상 */
export function deliverySpike(today: OpsInput['today'], noDeviceAvg: number): { failed: boolean; noDevice: boolean } {
  return {
    failed: today.failed >= Math.max(2, Math.ceil(today.total * 0.1)),
    noDevice: today.noDevice >= Math.max(3, noDeviceAvg * 2),
  };
}

export function opsAlerts({ now, deliveries, ingest, today, noDeviceAvg }: OpsInput): AdminAlert[] {
  const out: AdminAlert[] = [];
  const t = now.getTime();

  if (deliveries) {
    const last = deliveries.lastFinishedAt ? Date.parse(deliveries.lastFinishedAt) : null;
    const running = deliveries.runningSince !== null && t - Date.parse(deliveries.runningSince) <= DELIVERY_STALE_MS;
    if (!running && (last === null || t - last > DELIVERY_STALE_MS)) {
      out.push({
        title: '소식 지급·알림이 5분 넘게 돌지 않았어요',
        detail: `${last === null ? '끝난 기록이 없어요' : `마지막으로 끝난 때 ${kstTime(deliveries.lastFinishedAt!)}(${ago(t - last)} 전)`}. 1분마다 돌아야 해요. Supabase pg_cron(maengo-deliveries, cron_status())과 Vercel 로그(/api/cron/deliveries)를 보세요.`,
      });
    } else if (deliveries.lastStatus === 'failed') {
      out.push({ title: '소식 지급·알림 마지막 실행이 실패했어요', detail: `${deliveries.lastError ?? '이유 없음'}. 다음 실행(1분 뒤)이 이어 해요. 계속 뜨면 Vercel 로그를 보세요.` });
    }
  }

  if (ingest?.enabled) {
    const todayKst = kstDate(now);
    const finishedToday = ingest.lastFinishedAt !== null && kstDate(new Date(ingest.lastFinishedAt)) === todayKst;
    if (ingest.lastStatus === 'failed' && finishedToday) {
      const fails = Number(ingest.lastStats?.fails) || 1;
      const retryAt = typeof ingest.lastStats?.retryAt === 'string' ? ingest.lastStats.retryAt : null;
      out.push({
        title: `오늘 수집이 실패했어요(${fails}번)`,
        detail: `${ingest.lastError ?? '이유 없음'}. ${retryAt ? `${kstTime(retryAt)}에 다시 해요.` : '오늘은 더 다시 하지 않아요. 고친 뒤 scheduler_tasks의 ingest next_run_at을 지금으로 바꾸면 5분 안에 돌아요.'} 새 글이 없으면 배송은 지난 소식으로만 만들어요.`,
      });
    } else if (!finishedToday && !ingest.runningSince && kstHour(now) >= INGEST_DUE_HOUR) {
      out.push({
        title: '오늘 수집이 아직 안 돌았어요',
        detail: `마지막 ${ingest.lastFinishedAt ? kstTime(ingest.lastFinishedAt) : '기록 없음'}, 다음 차례 ${ingest.nextRunAt ? kstTime(ingest.nextRunAt) : '—'}. pg_cron(maengo-scheduler)과 Vercel 로그(/api/cron/scheduler)를 보세요.`,
      });
    }
  }

  const spike = deliverySpike(today, noDeviceAvg);
  if (spike.failed) {
    out.push({
      title: `오늘 소식 지급 실패가 ${today.failed}건이에요`,
      detail: `오늘 처리한 ${today.total}건 중. delivery_jobs(status='failed')의 last_error를 보세요. 날짜가 지나 접힌 줄은 어제 날짜로 남아 여기 세지 않아요.`,
    });
  }
  if (spike.noDevice) {
    out.push({
      title: `오늘 '기기 없음'이 평소보다 많아요(${today.noDevice}건)`,
      detail: `지난 7일 하루 평균 ${noDeviceAvg.toFixed(1)}건. FCM 발송 실패(서비스 계정·할당량)인지 delivery_jobs(status='no_device')의 last_error를 보세요.`,
    });
  }
  return out;
}
