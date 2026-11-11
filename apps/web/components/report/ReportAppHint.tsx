"use client";

import { useSyncExternalStore } from "react";
import { AppQr } from "@/components/app-install/AppQr";
import { useProfile } from "@/components/providers/ProfileProvider";
import { track } from "@/lib/analytics";
import { isAppUserAgent } from "@/lib/app-client";
import { installHref, isMobileWeb, SAME_ACCOUNT } from "@/lib/app-install";

// 리포트 맨 아래(2026-11-11 사용자: 알림을 계속 보내야 해서 앱으로): 웹에서 리포트를 끝까지 본 회원에게 다음 리포트는 앱 알림으로.
// 휴대폰 웹은 '알림 받기'(스토어로), PC는 휴대폰으로 찍을 QR. 앱 안·앱을 연 적 있는 회원에겐 안 보인다. 늘 있는 자리라 하루 한 번 셈에 넣지 않는다

const noSubscribe = () => () => {};

export function ReportAppHint() {
  const { usesApp } = useProfile();
  const where = useSyncExternalStore(noSubscribe, () => (isAppUserAgent(navigator.userAgent) ? "app" : isMobileWeb() ? "mobile" : "pc"), () => "app");
  if (usesApp || where === "app") return null;
  return (
    <section aria-label="다음 리포트 알림" className="tile flex items-center gap-3 p-4">
      {where === "pc" && <AppQr spot="side" size={72} />}
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-bold leading-snug tracking-[-0.02em]">다음 리포트는 월요일 아침 알림으로 받아요</p>
        <p className="mt-1 text-[13px] font-medium leading-snug text-sub">{where === "pc" ? "휴대폰 카메라로 찍으면 맹고 앱을 받아요" : SAME_ACCOUNT}</p>
      </div>
      {where === "mobile" && (
        <a href={installHref("report_end")} onClick={() => track("app_install_click", { where: "report_end" })} className="btn btn-ink min-h-10 shrink-0 px-4 text-[14px]">
          알림 받기
        </a>
      )}
    </section>
  );
}
