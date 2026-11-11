"use client";

import { useEffect, useRef, useState } from "react";
import { MangoIcon } from "@/components/MangoIcon";
import { IconClose } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { track } from "@/lib/analytics";
import { hiddenRecently, hideFor7Days, installHref, isMobileWeb, markNudgeClosed, markNudgeShown, nudgeAllowed, SAME_ACCOUNT } from "@/lib/app-install";

// 휴대폰 웹에서 화면이 꺼져 브리핑 듣기가 멈췄을 때 한 번 권하는 앱(2026-11-11, lib/app-install.ts).
// 재생 중에 화면이 꺼졌다가(visibilitychange hidden) 돌아왔을 때 멈춰 있으면 위쪽에 띄운다. 끝까지 들었거나(done) 계속 재생 중이면 띄우지 않는다.
// 7일에 한 번, 앱을 연 적 있는 회원에겐 안 보인다. 위쪽에 두는 건 아래에 플레이어·되돌리기 알림이 있어서다.
// 다른 앱 권유와 합쳐 하루 한 번, 두 번 닫으면 30일 쉰다(2026-11-11, lib/app-install.ts nudgeAllowed).
const KEY = "maengo_listen_app_nudge";
/** 돌아온 직후엔 멈춤 이벤트가 늦게 올 수 있어 조금 뒤에 본다 */
const SETTLE_MS = 600;

export function ListenAppNudge() {
  const { status } = usePlayer();
  const { usesApp } = useProfile();
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (usesApp || !isMobileWeb()) return;
    let wasPlaying = false;
    let timer = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasPlaying = statusRef.current === "playing";
        return;
      }
      if (!wasPlaying) return;
      wasPlaying = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (statusRef.current !== "paused" || hiddenRecently(KEY) || !nudgeAllowed()) return;
        hideFor7Days(KEY);
        markNudgeShown();
        setShow(true);
      }, SETTLE_MS);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(timer);
    };
  }, [usesApp]);

  if (!show) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-50 mx-auto max-w-[440px]">
      <div className="tile flex items-center gap-3 p-3 shadow-[0_8px_28px_rgb(31_35_64/0.18)]">
        <MangoIcon className="size-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-snug text-balance">앱에서는 화면을 꺼도 끝까지 들려요</p>
          <p className="mt-0.5 text-[12px] font-medium leading-snug text-sub">{SAME_ACCOUNT}</p>
        </div>
        <a
          href={installHref("listen_stopped")}
          onClick={() => track("app_install_click", { where: "listen_stopped" })}
          className="btn btn-ink min-h-9 shrink-0 px-4 text-[14px]"
        >
          앱에서 듣기
        </a>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => {
            markNudgeClosed();
            setShow(false);
          }} className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full text-sub">
          <IconClose className="size-4" />
        </button>
      </div>
    </div>
  );
}
