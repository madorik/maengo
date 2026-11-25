import { addDays } from './util/kst';

// 주간 리포트의 '지난주 경제는'(2026-11-25 사용자: 지난주 받은 소식이 경제와 내 관심사에 어떤 영향이었는지, 숫자는 차트로).
// 숫자는 한국은행 경제통계시스템(ECOS) Open API 일별 통계에서 받는다(무료, 키는 ECOS_API_KEY). 받는 쪽은 pipeline/src/lib/markets.ts.
// 여기는 DB·네트워크 없이 모양·읽기·계산만. 날짜는 KST 'YYYY-MM-DD'.

export type MarketKey = 'kospi' | 'kosdaq' | 'usdkrw' | 'ktb3y';

/** 화면·프롬프트에 쓰는 순서 */
export const MARKET_KEYS: readonly MarketKey[] = ['kospi', 'kosdaq', 'usdkrw', 'ktb3y'];

export const isMarketKey = (v: unknown): v is MarketKey => typeof v === 'string' && (MARKET_KEYS as readonly string[]).includes(v);

/** 값 단위: 지수는 단위 없이, 환율은 원, 금리는 % */
export type MarketUnit = '' | '원' | '%';

/** ECOS 통계표·항목 코드(2026-11-25 sample 키로 확인). 지수는 종가, 환율은 매매기준율, 금리는 장 마감 수익률 */
export const MARKET_SERIES: Record<MarketKey, { name: string; unit: MarketUnit; stat: string; item: string; digits: number }> = {
  kospi: { name: '코스피', unit: '', stat: '802Y001', item: '0001000', digits: 2 },
  kosdaq: { name: '코스닥', unit: '', stat: '802Y001', item: '0089000', digits: 2 },
  usdkrw: { name: '원·달러 환율', unit: '원', stat: '731Y001', item: '0000001', digits: 1 },
  ktb3y: { name: '국고채 3년 금리', unit: '%', stat: '817Y002', item: '010200000', digits: 2 },
};

export interface MarketPoint {
  date: string;
  value: number;
}

/** 리포트에 담는 지표 하나: 앞 주와 그 주의 거래일 값(날짜 오름차순) */
export interface ReportMarket {
  key: MarketKey;
  name: string;
  unit: MarketUnit;
  points: MarketPoint[];
}

/**
 * ECOS StatisticSearch 응답(JSON)에서 날짜·값만. 'YYYYMMDD' → 'YYYY-MM-DD', 숫자가 아니면 버린다.
 * 자료가 없으면 { RESULT: { CODE: 'INFO-200' } }가 오는데 그때도 빈 배열
 */
export function parseEcos(json: unknown): MarketPoint[] {
  const rows = (json as { StatisticSearch?: { row?: unknown } } | null)?.StatisticSearch?.row;
  if (!Array.isArray(rows)) return [];
  const out: MarketPoint[] = [];
  for (const r of rows) {
    const time = String((r as { TIME?: unknown })?.TIME ?? '');
    const value = Number((r as { DATA_VALUE?: unknown })?.DATA_VALUE);
    if (!/^\d{8}$/.test(time) || !Number.isFinite(value)) continue;
    out.push({ date: `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)}`, value });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** 그 주(월~일) 거래일 값만 */
export const weekPoints = (m: ReportMarket, start: string): MarketPoint[] => m.points.filter((p) => p.date >= start && p.date <= addDays(start, 6));

export interface MarketChange {
  /** 견주는 값: 앞 주 마지막 거래일 값(없으면 그 주 첫 거래일 값) */
  from: number;
  /** 그 주 마지막 거래일 값 */
  to: number;
  diff: number;
  /** 등락률(%). 금리는 %p 차이로 읽으니 화면은 diff를 쓴다 */
  pct: number;
}

/** 한 주 등락. 그 주 거래일 값이 없으면 null */
export function marketChange(m: ReportMarket, start: string): MarketChange | null {
  const week = weekPoints(m, start);
  const last = week.at(-1);
  if (!last) return null;
  const before = m.points.filter((p) => p.date < start).at(-1) ?? week[0]!;
  const diff = last.value - before.value;
  return { from: before.value, to: last.value, diff, pct: before.value ? (diff / before.value) * 100 : 0 };
}

const grouped = (v: number, digits: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** '4,708.54' · '1,402.3원' · '3.05%' */
export function formatMarket(key: MarketKey, value: number): string {
  const s = MARKET_SERIES[key];
  return `${grouped(value, s.digits)}${s.unit}`;
}

/** 등락 글: 지수·환율은 '▼ 5.2%', 금리는 '▲ 0.08%p'. 0이면 '보합' */
export function formatChange(key: MarketKey, c: MarketChange): { arrow: '▲' | '▼' | ''; text: string; spoken: string } {
  const rate = key === 'ktb3y';
  const size = rate ? Math.abs(c.diff) : Math.abs(c.pct);
  const shown = `${size.toFixed(rate ? 2 : 1)}${rate ? '%p' : '%'}`;
  if (Number(size.toFixed(rate ? 2 : 1)) === 0) return { arrow: '', text: '보합', spoken: '보합' };
  const up = c.diff > 0;
  return { arrow: up ? '▲' : '▼', text: `${up ? '▲' : '▼'} ${shown}`, spoken: `${shown} ${up ? '올랐어요' : '내렸어요'}` };
}

/** 프롬프트 한 줄: '- kospi 코스피: 4,968.48 → 4,708.54 (▼ 5.2%)' */
export function marketPromptLine(m: ReportMarket, start: string): string | null {
  const c = marketChange(m, start);
  if (!c) return null;
  return `- ${m.key} ${m.name}: ${formatMarket(m.key, c.from)} → ${formatMarket(m.key, c.to)} (${formatChange(m.key, c).text})`;
}
