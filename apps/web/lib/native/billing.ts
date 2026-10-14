import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Purchases, type PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { MAENGO_PACKS, PREMIUM_PRODUCT } from "@maengo/core/plans";

// 앱 안 결제(RevenueCat → 애플 인앱 결제·구글 플레이 결제). 웹 브라우저에서는 쓰지 않는다.
// app_user_id는 Supabase 회원 id라 서버(/api/billing/sync, 웹훅)가 같은 사람으로 맞춘다. apps/mobile/BILLING.md
// 플러그인의 네이티브 쪽은 apps/mobile에 같은 버전으로 설치돼 있어야 한다.

export const inAppStore = () => Capacitor.isNativePlatform();

function apiKey(): string | undefined {
  const key = Capacitor.getPlatform() === "ios" ? process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY : process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY;
  return key?.trim() || undefined;
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
}

const baseId = (id: string) => id.split(":")[0]!;

/** 지금 오퍼링에서 Premium과 맹고 묶음을 꺼낸다(가격은 스토어가 그 나라 통화로 준다) */
export async function loadStore(userId: string): Promise<{ premium: StoreItem | null; packs: StoreItem[] }> {
  await ready(userId);
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  const items = pkgs.map((pkg): StoreItem => {
    const productId = baseId(pkg.product.identifier);
    return { pkg, productId, price: pkg.product.priceString, maengo: MAENGO_PACKS[productId] ?? null };
  });
  return {
    premium: items.find((i) => i.productId === PREMIUM_PRODUCT) ?? null,
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
    return (await fetch("/api/billing/sync", { method: "POST" })).ok;
  } catch {
    return false;
  }
}

/** 결제한다. 결제를 마쳤으면 synced는 서버 반영까지 끝났는지(false면 웹훅으로 조금 뒤에 들어온다). 결제 실패·취소는 예외 */
export async function buy(userId: string, item: StoreItem): Promise<{ synced: boolean }> {
  await ready(userId);
  await Purchases.purchasePackage({ aPackage: item.pkg });
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
