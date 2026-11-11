"use client";

import { useState, useTransition } from "react";
import { setPersonalInsightAction } from "@/app/(app)/context-actions";
import { Toggle } from "@/components/ui/Switch";

/**
 * 설정 > 맞춤 인사이트 켜고 끄기(2026-11-11, 개인정보 처리방침 5조의 국외 이전 거부 방법).
 * 끄면 내 맞춤 정보와 최근 본 소식을 오늘의 흐름에 쓰지 않고(소식 요약만으로 만든다) 맞춤 정보 질문도 하지 않는다
 */
export function PersonalInsightToggle({ on: initial }: { on: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();
  return (
    <Toggle
      label="맞춤 인사이트"
      checked={on}
      disabled={busy}
      onChange={(next) =>
        start(async () => {
          setOn(next);
          const res = await setPersonalInsightAction(next).catch(() => ({ ok: false }));
          if (!res.ok) setOn(!next);
        })
      }
    />
  );
}
