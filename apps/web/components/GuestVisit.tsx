"use client";

import { kstDate } from "@maengo/core/kst";
import { useEffect } from "react";
import { withBase } from "@/lib/base-path";
import { SIGNED_IN_HINT } from "@/lib/session-cookie";

// 로그인 안 한 방문자를 하루 한 번 센다(app/api/visit, 관리자 요약 탭의 가입 전환율). 모든 화면의 뿌리(app/layout.tsx)에 있다.
// 로그인한 사람(로그인 힌트 쿠키)은 부르지 않는다. 기기마다 그날만 쓰는 무작위 값을 보내고(날이 바뀌면 새 값), 오늘 보냈으면 다시 보내지 않는다.
// 저장소가 막혀 있으면 값 없이 보내고 서버가 IP·User-Agent로 같은 사람을 가른다.
const KEY = "maengo_guest_visit";

export function GuestVisit() {
  useEffect(() => {
    if (document.cookie.split("; ").some((c) => c.startsWith(`${SIGNED_IN_HINT}=`))) return;
    const day = kstDate();
    let id: string | undefined;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { day?: string; id?: string; sent?: boolean } | null;
      if (saved?.day === day && saved.sent) return;
      id = saved?.day === day && saved.id ? saved.id : crypto.randomUUID?.();
      if (id) localStorage.setItem(KEY, JSON.stringify({ day, id }));
    } catch {
      id = undefined;
    }
    fetch(withBase("/api/visit"), { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) })
      .then((r) => {
        if (!r.ok || !id) return;
        try {
          localStorage.setItem(KEY, JSON.stringify({ day, id, sent: true }));
        } catch {}
      })
      .catch(() => {});
  }, []);
  return null;
}
