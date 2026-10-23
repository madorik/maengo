// 시세·증시 마감 기사: 지수·환율·유가·코인·주가가 오르내린 소식. 이틀이 지나면 틀린 정보라 주지 않는다(2026-10-23 사용자 결정).
// 하루 소식이 모자라 한 달 전까지 찾다가 10-15 '코스피 7.57% 급락'이 10-23 소식으로 나간 일이 있었다(배송 178건 중 이틀 넘은 묶음 35건).
// 대표 글 제목(요약이 있으면 요약 제목)만 보고 판정한다. 실적(순이익 68% 급증)·정책·재판처럼 지수가 없는 소식은 시세가 아니다.

/** 시세 기사를 주는 최대 나이(묶음이 처음 보인 때부터) */
export const MARKET_QUOTE_MAX_HOURS = 48;

const KO_MARKET = /(코스피|코스닥|나스닥|다우|S&P\s?500|증시|지수|닛케이|항셍|상하이종합|환율|원[·ㆍ/-]?달러|달러[·ㆍ/-]?원|엔화|비트코인|이더리움|리플|코인 시장|국제유가|유가(?!족|증권)|금값|금 시세|국채 금리|채권 금리|주가)/;
const KO_MOVE = /(마감|장중|개장|출발|상승|하락|급등|급락|폭등|폭락|반등|반락|약세|강세|혼조|보합|최고치|최저치|신고가|돌파|붕괴|랠리|\d+(\.\d+)?\s?%)/;
const KO_QUOTE = /(시황|시세|증시 마감|장 마감|마감 시황)/;
const EN_MARKET = /\b(stocks?|stock market|wall street|dow|nasdaq|s&p 500|futures|treasury yields?|bitcoin|btc|ether(eum)?|crypto market|oil prices?|crude|gold prices?)\b/i;
const EN_MOVE = /\b(close[sd]?|rall(y|ies)|slides?|slumps?|falls?|jumps?|surges?|soars?|tumbles?|drops?|gains?|rises?|sinks?|record high|today|\d+(\.\d+)?\s?%)/i;

export function isMarketQuote(title: string): boolean {
  return KO_QUOTE.test(title) || (KO_MARKET.test(title) && KO_MOVE.test(title)) || (EN_MARKET.test(title) && EN_MOVE.test(title));
}

/** 이틀 지난 시세 기사인지(rankFeed가 뺀다). 제목을 모르면 빼지 않는다 */
export function isStaleMarketQuote(c: { ageHours: number; title?: string | null }): boolean {
  return !!c.title && c.ageHours > MARKET_QUOTE_MAX_HOURS && isMarketQuote(c.title);
}
