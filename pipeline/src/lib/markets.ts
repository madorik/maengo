import { MARKET_KEYS, MARKET_SERIES, parseEcos, weekPoints, type MarketKey, type ReportMarket } from '@maengo/core/markets';
import { env } from './env';

// 주간 리포트 '지난주 경제는'의 시장 지표(2026-11-25): 한국은행 경제통계시스템(ECOS) Open API 일별 통계.
// 키(ECOS_API_KEY, ecos.bok.or.kr에서 무료 발급)가 없으면 받지 않는다(리포트는 지표 칸 없이 만든다).
// 같은 기간은 모든 회원이 같아서 한 번 받은 것을 한 시간 동안 다시 쓴다(아침 작업이 회원마다 부르니까).

const TIMEOUT_MS = 8_000;
const CACHE_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: Promise<ReportMarket[]> }>();

const ymd = (date: string) => date.replaceAll('-', '');

async function series(key: MarketKey, from: string, to: string, apiKey: string): Promise<ReportMarket | null> {
  const s = MARKET_SERIES[key];
  // 두 주라 거래일은 많아야 10일. 시험용 키(sample)는 10건까지만 받는다
  const rows = apiKey === 'sample' ? 10 : 40;
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(apiKey)}/json/kr/1/${rows}/${s.stat}/D/${ymd(from)}/${ymd(to)}/${s.item}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { RESULT?: { CODE?: string; MESSAGE?: string } };
    const points = parseEcos(json);
    // 자료 없음(INFO-200)이 아닌 결과 코드는 키·요청이 잘못된 것이라 남긴다
    if (!points.length && json.RESULT?.CODE && json.RESULT.CODE !== 'INFO-200') throw new Error(`${json.RESULT.CODE} ${json.RESULT.MESSAGE ?? ''}`);
    return points.length ? { key, name: s.name, unit: s.unit, points } : null;
  } catch (e) {
    console.warn('[markets] 지표 받기 실패', key, String((e as Error)?.message ?? e).slice(0, 120));
    return null;
  }
}

/**
 * 앞 주 월요일(from)부터 그 주 일요일(to)까지 지표. 그 주(start~to) 거래일 값이 2개 이상인 지표만(선이 그려지게).
 * 키가 없거나 다 실패하면 빈 배열
 */
export function marketsFor(from: string, start: string, to: string): Promise<ReportMarket[]> {
  const apiKey = env.ecosKey;
  if (!apiKey) return Promise.resolve([]);
  const id = `${from}|${to}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = Promise.all(MARKET_KEYS.map((k) => series(k, from, to, apiKey))).then((list) =>
    list.filter((m): m is ReportMarket => !!m && weekPoints(m, start).length >= 2),
  );
  // 전부 실패하면 담아 두지 않는다(다음 회원 차례에 다시 받는다)
  cache.set(id, { at: Date.now(), value });
  void value.then((list) => {
    if (!list.length) cache.delete(id);
  });
  return value;
}
