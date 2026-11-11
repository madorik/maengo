"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { setPushEnabled } from "@/app/actions";
import { track } from "@/lib/analytics";
import { useProfile } from "@/components/providers/ProfileProvider";
import { Toggle } from "@/components/ui/Switch";
import { appPushRegisteredHere, isAppUserAgent } from "@/lib/app-client";
import { installHref, isMobileWeb, SAME_ACCOUNT } from "@/lib/app-install";
import { registeredHere, registerThisBrowser, type RegisterResult } from "@/lib/web-push";

const FAIL: Record<Extract<RegisterResult, { ok: false }>["reason"], string> = {
  unsupported: "이 브라우저는 알림을 받을 수 없어요. Chrome·Edge·Firefox나 맥의 Safari에서 켜 주세요.",
  denied: "브라우저가 이 사이트의 알림을 막고 있어요. 주소창 왼쪽의 사이트 설정에서 알림을 허용한 뒤 다시 켜 주세요.",
  update: "앱을 최신 버전으로 업데이트하면 알림을 켤 수 있어요.",
  failed: "알림을 켜지 못했어요. 잠시 뒤 다시 켜 주세요.",
};

/** 앱에서 알림 권한을 거절했을 때(브라우저 안내 대신) */
const APP_DENIED = "휴대폰 설정 > 앱 > 맹고 > 알림에서 허용한 뒤 다시 켜 주세요.";

const noSubscribe = () => () => {};

/**
 * 설정 > 알림 제목 옆의 켜고 끄기. 켜면 이 브라우저를 받을 기기로 등록하고, 끄면 어느 기기에도 보내지 않는다.
 * 제목 줄(flex-wrap) 안에 놓여서, 오류와 '이 브라우저에서도 받기'는 basis-full로 다음 줄에 내려간다
 */
export function PushToggle({ enabled, webTokens }: { enabled: boolean; webTokens: string[] }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  /** 켜지 못한 이유(성공은 스위치로 보인다) */
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // 다른 기기에서 켰고 이 브라우저는 아직 안 받는 경우 '이 브라우저에서도 받기'를 보여 준다(앱 안에서는 숨긴다)
  const canWebPush = useSyncExternalStore(noSubscribe, () => !isAppUserAgent(navigator.userAgent) && "PushManager" in window, () => false);
  const here = useSyncExternalStore(noSubscribe, () => registeredHere(webTokens), () => true);
  // 앱: 다른 기기에서 켰고 이 앱 기기는 아직 안 받는 경우 '이 기기에서도 받기'
  const inApp = useSyncExternalStore(noSubscribe, () => isAppUserAgent(navigator.userAgent), () => false);
  const appHere = useSyncExternalStore(noSubscribe, appPushRegisteredHere, () => true);
  // 휴대폰 브라우저인데 웹 알림이 없는 곳(iPhone 사파리·카카오톡 안 등)은 앱으로 받는다(2026-11-11, lib/app-install.ts). 앱을 연 적 있으면 안 보인다
  const { usesApp } = useProfile();
  const appInstead = useSyncExternalStore(noSubscribe, () => isMobileWeb() && !("PushManager" in window), () => false);

  const toggle = (next: boolean) =>
    start(async () => {
      setError(null);
      if (next) {
        const r = await registerThisBrowser();
        if (!r.ok) {
          // 앱 받기 안내가 아래에 보이는 중이면 PC 브라우저용 안내는 띄우지 않는다
          if (!(r.reason === "unsupported" && appInstead && !usesApp)) setError(r.reason === "denied" && isAppUserAgent(navigator.userAgent) ? APP_DENIED : FAIL[r.reason]);
          return;
        }
      }
      const res = await setPushEnabled(next);
      // 끄면 서버가 이 사람의 기기 토큰을 모두 지운다. 앱은 다음에 열 때 다시 등록하지 않게 잊는다
      if (!res.enabled && isAppUserAgent(navigator.userAgent)) (await import("@/lib/native/push")).forgetApp();
      setOn(res.enabled);
      track("notify_toggle", { on: res.enabled });
      setError(res.error ?? null);
    });

  const addHere = () =>
    start(async () => {
      setError(null);
      const r = await registerThisBrowser();
      if (r.ok) router.refresh();
      else setError(FAIL[r.reason]);
    });

  return (
    <>
      <Toggle label="알림 받기" checked={on} disabled={busy} onChange={toggle} />
      {on && ((canWebPush && !here) || (inApp && !appHere)) && !busy && (
        <div className="mt-2 basis-full">
          <button type="button" onClick={addHere} className="btn btn-ghost min-h-11 px-4 text-[14px]">
            {inApp ? "이 기기에서도 받기" : "이 브라우저에서도 받기"}
          </button>
        </div>
      )}
      {appInstead && !usesApp && (
        <div className="mt-2 flex basis-full items-center justify-between gap-3">
          <p className="text-[14px] font-medium text-sub">
            휴대폰 알림은 맹고 앱으로 받아요
            <span className="mt-0.5 block text-[13px]">{SAME_ACCOUNT}</span>
          </p>
          <a
            href={installHref("push_settings")}
            onClick={() => track("app_install_click", { where: "push_settings" })}
            className="btn btn-ink min-h-9 shrink-0 px-4 text-[14px]"
          >
            알림 받기
          </a>
        </div>
      )}
      <p aria-live="polite" className="mt-2 basis-full text-[14px] font-bold text-cherry empty:hidden">
        {error}
      </p>
    </>
  );
}
