"use client";

import { useFormStatus } from "react-dom";
import { track } from "@/lib/analytics";

/** 온보딩 '시작하기'. 보내는 동안은 막아 두 번 보내지 않는다. 몇 개 골랐는지만 분석에 남긴다(무엇을 적었는지는 남기지 않는다) */
export function OnboardingSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        const picked = e.currentTarget.form?.querySelectorAll('input[type="checkbox"]:checked').length ?? 0;
        track("onboarding_complete", { topics: picked });
      }}
      className="btn w-full"
    >
      {pending ? "시작하는 중" : "고른 분야로 시작하기"}
    </button>
  );
}
