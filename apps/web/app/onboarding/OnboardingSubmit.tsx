"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { track } from "@/lib/analytics";
import { registerThisBrowser } from "@/lib/web-push";

/**
 * 온보딩 '시작하기'. 누르면 먼저 알림 권한을 묻고(앱은 기기 창, 웹은 브라우저 창) 허용하면 이 기기를 등록한 뒤 보낸다.
 * 서버는 등록된 기기가 있으면 알림을 켠 채로 시작한다(completeOnboarding, 2026-10-23 사용자 결정: 따로 누르는 단계 없이).
 * 거절하거나 알림을 못 받는 브라우저면 알림 없이 시작한다. 보내는 동안은 막아 두 번 보내지 않는다.
 * 몇 개 골랐는지만 분석에 남긴다(무엇을 적었는지는 남기지 않는다)
 */
export function OnboardingSubmit() {
  const { pending } = useFormStatus();
  const [asking, setAsking] = useState(false);
  /** 권한은 한 번만 묻는다(되돌아와 다시 누르면 바로 보낸다) */
  const asked = useRef(false);
  const push = useRef<HTMLInputElement>(null);

  const start = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form;
    const picked = form?.querySelectorAll('input[type="checkbox"]:checked').length ?? 0;
    track("onboarding_complete", { topics: picked });
    if (!form || asked.current) return;
    e.preventDefault();
    setAsking(true);
    const r = await registerThisBrowser().catch(() => ({ ok: false as const }));
    asked.current = true;
    if (push.current) push.current.value = r.ok ? "on" : "";
    track("notify_toggle", { on: r.ok, group: "onboarding" });
    setAsking(false);
    form.requestSubmit();
  };

  return (
    <>
      <input ref={push} type="hidden" name="push" defaultValue="" />
      <button type="submit" disabled={pending || asking} onClick={start} className="btn w-full">
        {pending || asking ? "시작하는 중" : "고른 분야로 시작하기"}
      </button>
    </>
  );
}
