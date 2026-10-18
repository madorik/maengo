import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { INTRO_ELIGIBILITY_STATUS, Purchases, type PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { MAENGO_PACKS, PREMIUM_PRODUCT } from "@maengo/core/plans";
import { withBase } from "@/lib/base-path";

// 앱 안 결제(RevenueCat → 애플 인앱 결제·구글 플레이 결제). 웹 브라우저에서는 쓰지 않는다.
// app_user_id는 Supabase 회원 id라 서버(/api/billing/sync, 웹훅)가 같은 사람으로 맞춘다. apps/mobile/BILLING.md
// 플러그인의 네이티브 쪽은 apps/mobile에 같은 버전으로 설치돼 있어야 한다.

export const inAppStore = () => Capacitor.isNativePlatform();

function apiKey(): string | undefined {
  const key = (Capacitor.getPlatform() === "ios" ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY : process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY)?.trim();
  // RevenueCat Test Store 키(test_…)는 로컬 개발 서버에서만 쓴다. 릴리스 앱은 이 키를 받으면 SDK가 일부러 멈춰서, 운영 빌드에 잘못 들어가도 쓰지 않는다
  if (!key || (key.startsWith("test_") && process.env.NODE_ENV === "production")) return undefined;
  return key;
}

let configuredFor: string | null = null;

async function ready(userId: string) {
  if (configuredFor === userId) return;
  const key = apiKey();
  if (!key) throw new Error("no_store_key");
  if ((await Purchases.isConfigured()).isConfigured) await Purchases.logIn({ appUserID: userId });
  else await Purchases.configure({ apiKey: key, appUserID: userId });
  configuredFor = userId;
}

export interface StoreItem {
  pkg: PurchasesPackage;
  productId: string;
  price: string;
  /** 맹고 묶음이면 맹고 수, Premium이면 null */
  maengo: number | null;
  /** 이 사람이 받을 수 있는 무료 체험 일수(스토어 첫 구독 7일 무료, 결정 D3). 없거나 이미 써 봤으면 null */
  trialDays: number | null;
}

const baseId = (id: string) => id.split(":")[0]!;

const UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

/** 스토어에 걸어 둔 무료 체험(0원 첫 기간) 일수 */
function trialOf(pkg: PurchasesPackage): number | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  return (UNIT_DAYS[intro.periodUnit] ?? 0) * intro.periodNumberOfUnits * Math.max(1, intro.cycles) || null;
}

/** iOS는 체험을 이미 써 본 사람에게도 상품에 체험이 붙어 와서 따로 묻는다(구글은 받을 수 있는 체험만 준다) */
async function trialEligible(productId: string): Promise<boolean> {
  if (Capacitor.getPlatform() !== "ios") return true;
  const res = await Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: [productId] }).catch(() => null);
  return res?.[productId]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
}

/** 지금 오퍼링에서 Premium과 맹고 묶음을 꺼낸다(가격은 스토어가 그 나라 통화로 준다) */
export async function loadStore(userId: string): Promise<{ premium: StoreItem | null; packs: StoreItem[] }> {
  await ready(userId);
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  const items = pkgs.map((pkg): StoreItem => {
    const productId = baseId(pkg.product.identifier);
    return { pkg, productId, price: pkg.product.priceString, maengo: MAENGO_PACKS[productId] ?? null, trialDays: null };
  });
  const premium = items.find((i) => i.productId === PREMIUM_PRODUCT) ?? null;
  if (premium) {
    const days = trialOf(premium.pkg);
    if (days && (await trialEligible(premium.pkg.product.identifier))) premium.trialDays = days;
  }
  return {
    premium,
    packs: items.filter((i) => i.maengo !== null).sort((a, b) => a.maengo! - b.maengo!),
  };
}

/** 사용자가 결제 창을 닫은 것(오류로 보이지 않는다) */
export const isCancelled = (e: unknown) => {
  const err = e as { userCancelled?: boolean; code?: string | number } | null;
  return !!err && (err.userCancelled === true || String(err.code) === "1");
};

/** 서버가 RevenueCat에서 다시 읽어 플랜·지갑을 맞춘다. 실패해도 RevenueCat 웹훅이 곧 같은 일을 한다 */
async function syncServer(): Promise<boolean> {
  try {
    return (await fetch(withBase("/api/billing/sync"), { method: "POST" })).ok;
  } catch {
    return false;
  }
}

/**
 * 결제한다. 결제를 마쳤으면 synced는 서버 반영까지 끝났는지(false면 웹훅으로 조금 뒤에 들어온다). 결제 실패·취소는 예외.
 * noTrial: 전에 구독한 적 있는 회원이 다시 구독할 때. 안드로이드는 무료 체험 없는 기본 요금제로 결제한다
 * (iOS는 애플이 체험을 계정당 한 번만 주므로 그대로 둔다)
 */
export async function buy(userId: string, item: StoreItem, { noTrial = false }: { noTrial?: boolean } = {}): Promise<{ synced: boolean }> {
  await ready(userId);
  // 기본 선택지에 무료 체험이 있을 때만 체험 없는 기본 요금제를 고른다(체험이 없으면 그냥 결제. Test Store는 요금제 고르기를 못 한다)
  const hasTrial = !!item.pkg.product.defaultOption?.freePhase;
  const base = noTrial && hasTrial && Capacitor.getPlatform() === "android" ? item.pkg.product.subscriptionOptions?.find((o) => o.isBasePlan) : undefined;
  if (base) await Purchases.purchaseSubscriptionOption({ subscriptionOption: base });
  else await Purchases.purchasePackage({ aPackage: item.pkg });
  return { synced: await syncServer() };
}

/** 구매 복원(애플 심사 필수). 다른 기기·재설치 뒤 구독을 다시 잇는다 */
export async function restore(userId: string): Promise<void> {
  await ready(userId);
  await Purchases.restorePurchases();
  if (!(await syncServer())) throw new Error("sync");
}

/** 스토어의 구독 관리 화면(해지·결제 수단) */
export async function openManage(userId: string): Promise<void> {
  await ready(userId);
  const { customerInfo } = await Purchases.getCustomerInfo();
  const url =
    customerInfo.managementURL ??
    (Capacitor.getPlatform() === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions");
  await Browser.open({ url });
}
