"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { isAppUserAgent } from "@/lib/app-client";
import type { StoreItem } from "@/lib/native/billing";

// /premium 페이지의 앱 안 결제 조각들이 같이 쓰는 상태. 스토어 상품은 한 번만 불러 나눠 쓴다.
// 결제·복원을 마치면 서버(/api/billing/sync)가 플랜·추가 구매한 맹고를 맞추고, 화면을 새로 그린다.

export type Store = { premium: StoreItem | null; packs: StoreItem[] };
export type Billing = typeof import("@/lib/native/billing");

const billing = (): Promise<Billing> => import("@/lib/native/billing");
const noSubscribe = () => () => {};
let loading: Promise<Store> | null = null;

function loadOnce(uid: string): Promise<Store> {
  loading ??= billing()
    .then((b) => b.loadStore(uid))
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

/** 앱 안인지. 서버에서는 모른다(null) → 그리지 않다가 브라우저에서 정한다 */
export function useInApp(): boolean | null {
  return useSyncExternalStore(noSubscribe, () => isAppUserAgent(navigator.userAgent), () => null);
}

export function useStore(uid: string) {
  const router = useRouter();
  const inApp = useInApp();
  const [store, setStore] = useState<Store | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inApp) return;
    let live = true;
    loadOnce(uid).then(
      (s) => live && setStore(s),
      () => live && setLoadFailed(true),
    );
    return () => {
      live = false;
    };
  }, [inApp, uid, attempt]);

  const retry = () => {
    setLoadFailed(false);
    setAttempt((n) => n + 1);
  };

  /** 스토어 일 하나를 돌린다(끝나면 화면을 새로 그리고 true). 사용자가 결제 창을 닫은 건 오류로 보이지 않는다 */
  const run = async (key: string, fn: (b: Billing) => Promise<unknown>, failText: string): Promise<boolean> => {
    setBusy(key);
    setError(null);
    const b = await billing();
    try {
      await fn(b);
      router.refresh();
      return true;
    } catch (e) {
      if (!b.isCancelled(e)) setError(failText);
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { inApp, store, loadFailed, retry, busy, error, run };
}
