"use client";

import type { Plan } from "@maengo/core/types";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useProfile } from "@/components/providers/ProfileProvider";

/**
 * 서버가 이 화면을 그릴 때 읽은 플랜이 바깥 틀(계정 메뉴)의 플랜과 다르면 한 번 새로 그린다.
 * Next는 화면을 옮길 때 레이아웃을 다시 그리지 않아서, 만료·갱신 웹훅처럼 서버에서만 플랜이 바뀌면 계정 메뉴가 예전 플랜을 보인다
 * (결제·복원은 끝나면 useStore가 새로 그린다)
 */
export function PlanSync({ plan }: { plan: Plan }) {
  const router = useRouter();
  const shown = useProfile().plan;
  const tried = useRef<Plan | null>(null);
  useEffect(() => {
    if (plan === shown || tried.current === plan) return;
    tried.current = plan;
    router.refresh();
  }, [plan, shown, router]);
  return null;
}
