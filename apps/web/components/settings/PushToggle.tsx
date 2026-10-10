"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { setPushEnabled } from "@/app/actions";
import { Toggle } from "@/components/ui/Switch";
import { isAppUserAgent } from "@/lib/app-client";
import { registeredHere, registerThisBrowser, type RegisterResult } from "@/lib/web-push";

const FAIL: Record<Extract<RegisterResult, { ok: false }>["reason"], string> = {
  unsupported: "이 브라우저는 알림을 받을 수 없어요. Chrome·Edge·Firefox나 맥의 Safari에서 켜 주세요.",
  denied: "브라우저가 이 사이트의 알림을 막고 있어요. 주소창 왼쪽의 사이트 설정에서 알림을 허용한 뒤 다시 켜 주세요.",
  app: "앱 알림은 다음 앱 업데이트부터 켤 수 있어요.",
  failed: "알림을 켜지 못했어요. 잠시 뒤 다시 켜 주세요.",
};

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

  const toggle = (next: boolean) =>
    start(async () => {
      setError(null);
      if (next) {
        const r = await registerThisBrowser();
        if (!r.ok) {
          setError(FAIL[r.reason]);
          return;
        }
      }
      const res = await setPushEnabled(next);
      setOn(res.enabled);
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
      {on && canWebPush && !here && !busy && (
        <div className="mt-2 basis-full">
          <button type="button" onClick={addHere} className="btn btn-ghost min-h-11 px-4 text-[14px]">
            이 브라우저에서도 받기
          </button>
        </div>
      )}
      <p aria-live="polite" className="mt-2 basis-full text-[14px] font-bold text-mango-deep empty:hidden">
        {error}
      </p>
    </>
  );
}
