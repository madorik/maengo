import 'server-only';
import { kstDate } from '@maengo/core/kst';
import { db, must } from './db';

// 관리자 화면 맨 위 빨간 줄: Gemini가 막혔는지(크레딧 소진 표시, 하루 지출 상한). 파이프라인 lib/ai-guard.ts와 같은 기준이다.

const FLAG = 'gemini_blocked';

export interface AdminAlert {
  title: string;
  detail: string;
}

export async function adminAlerts(now = new Date()): Promise<AdminAlert[]> {
  const out: AdminAlert[] = [];
  const flag = must(await db.from('service_flags').select('until,note').eq('key', FLAG).maybeSingle(), 'service_flags') as { until: string | null; note: string | null } | null;
  if (flag?.until && Date.parse(flag.until) > now.getTime()) {
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
