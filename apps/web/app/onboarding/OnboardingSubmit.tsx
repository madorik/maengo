"use client";

import { track } from "@/lib/analytics";

/** 온보딩 '시작하기'. 몇 개 골랐는지만 분석에 남긴다(무엇을 적었는지는 남기지 않는다) */
export function OnboardingSubmit() {
  return (
    <button
      type="submit"
      onClick={(e) => {
        const picked = e.currentTarget.form?.querySelectorAll('input[type="checkbox"]:checked').length ?? 0;
        track("onboarding_complete", { topics: picked });
      }}
      className="btn w-full"
    >
      고른 분야로 시작하기
    </button>
  );
}
