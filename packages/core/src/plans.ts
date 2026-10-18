import type { Plan } from './types';

// 플랜과 맹고에 관한 공용 정의. 플랜별 숫자는 DB plans 표에 있고(PlanLimits), 여기에는 플랜과 상관없는 값과 상품 ID만 둔다.
// DB 함수(wallet_sync 등)는 숫자를 갖고 있지 않고 여기 값을 인자로 받는다.

/**
 * 플랜별 값(plans 표 한 줄). 값은 DB plans 표가 정하고(supabase/migrations/20261014120000_plans.sql)
 * 웹·파이프라인이 1분 캐시로 읽는다. 배포 없이 표만 고치면 바뀐다.
 * 맹고 = 하루에 받는 소식 수(dailyItems). 더 받기는 지갑(가입 선물·추가 구매한 맹고)에서 1맹고씩 쓴다.
 */
export interface PlanLimits {
  id: Plan;
  name: string;
  /** 보여 주는 월 가격(원, 할인가). 스토어 상품 가격과 같게 둔다 */
  priceKrw: number;
  /** 취소선으로 보여 주는 정가(원). null이면 할인 없음 */
  listPriceKrw: number | null;
  /** 하루 맹고(하루에 받는 소식 수) */
  dailyItems: number;
  audio: boolean;
  /** 목록에서 고르는 관심사 수 */
  topicLimit: number;
  /** 기타(목록에 없는 걸 직접 적는) 관심사 수. 0이면 못 넣는다 */
  customLimit: number;
  /** 내 관심 링크(블로그·사이트 RSS) 수. 0이면 못 넣는다 */
  linkLimit: number;
  canBuyMaengo: boolean;
  /** 보관함에서 볼 수 있는 날 수(오늘 포함). null이면 전부 */
  archiveDays: number | null;
}

export interface PlanRow {
  id: Plan;
  name: string;
  price_krw: number;
  list_price_krw: number | null;
  daily_items: number;
  audio: boolean;
  topic_limit: number;
  custom_limit: number;
  link_limit: number;
  can_buy_maengo: boolean;
  archive_days: number | null;
}

export const PLAN_COLUMNS = 'id,name,price_krw,list_price_krw,daily_items,audio,topic_limit,custom_limit,link_limit,can_buy_maengo,archive_days';

export function planFromRow(r: PlanRow): PlanLimits {
  return {
    id: r.id,
    name: r.name,
    priceKrw: r.price_krw,
    listPriceKrw: r.list_price_krw,
    dailyItems: r.daily_items,
    audio: r.audio,
    topicLimit: r.topic_limit,
    customLimit: r.custom_limit,
    linkLimit: r.link_limit,
    canBuyMaengo: r.can_buy_maengo,
    archiveDays: r.archive_days,
  };
}

/** 정가 대비 할인율(%). 실제보다 크게 보이지 않게 내림한다(5,900 → 3,800은 35.6% → 35). 할인이 없으면 0 */
export function discountPct(p: Pick<PlanLimits, 'priceKrw' | 'listPriceKrw'>): number {
  if (!p.listPriceKrw || p.listPriceKrw <= p.priceKrw) return 0;
  return Math.floor(((p.listPriceKrw - p.priceKrw) / p.listPriceKrw) * 100);
}

/** 원 가격 표기 '3,800원'. 앱 결제 화면은 스토어가 준 가격(₩3,800 등 그 나라 통화)을 쓰고, 스토어가 없는 웹·서버 화면이 이것을 쓴다 */
export const krwLabel = (krw: number) => `${krw.toLocaleString('ko-KR')}원`;

/** 가입하면 한 번 지갑에 넣어 주는 맹고(플랜과 상관없음). 2026-10-17 100 → 10(가입 이벤트 팝업으로 알린다) */
export const SIGNUP_BONUS = 10;

/** 'YYYY-MM-DD'에서 n일 전(날짜 계산만, 시간대 무관) */
export function daysBefore(date: string, n: number): string {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) - n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * 인앱 상품. App Store Connect·Play Console·RevenueCat에 같은 ID로 만든다(apps/mobile/BILLING.md).
 * Premium은 자동 갱신 구독. 맹고 추가 구매는 수량마다 소모성 상품 하나다(스토어 결제에 수량 지정이 없어서).
 * 결제가 끝나면 서버가 RevenueCat에서 거래를 읽어 그 수량만큼 지갑에 넣는다.
 */
export const PREMIUM_PRODUCT = 'maengo_premium_monthly';
/** RevenueCat 권한(entitlement) ID. Premium 구독 상품을 여기에 붙인다 */
export const PREMIUM_ENTITLEMENT = 'premium';
export const MAENGO_PACKS: Record<string, number> = {
  maengo_pack_10: 10,
  maengo_pack_30: 30,
  maengo_pack_50: 50,
  maengo_pack_100: 100,
};

/** 스토어 상품 ID → 맹고 수. 플레이 구독처럼 'id:기본요금제' 꼴로 와도 앞부분으로 찾는다 */
export function packAmount(productId: string): number | null {
  return MAENGO_PACKS[productId.split(':')[0]!] ?? null;
}
