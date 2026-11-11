"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MangoIcon } from "@/components/MangoIcon";
import { IconClose } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { track } from "@/lib/analytics";
import { installHref, isMobileWeb, markNudgeClosed, markNudgeShown, nudgeAllowed, SAME_ACCOUNT } from "@/lib/app-install";
import { AppQr } from "./AppQr";

// 웹 회원에게 앱이 확실히 나은 순간 두 곳에서 한 번씩 권한다(2026-11-11 사용자: 알림을 계속 보내야 해서 앱으로, 자연스럽고 덜 귀찮게).
// - 다음 날 다시 웹으로 왔을 때(오늘 화면): '오늘 아침 브리핑, 앱이었다면 아침 7시에 알림으로 받았어요'
// - 브리핑을 끝까지 다 들었을 때: '내일 출근길에도 알려 드릴까요?'
// 앱을 연 적 있는 회원·앱 안에서는 안 보인다. 모든 끼어드는 앱 권유를 합쳐 하루 한 번, 두 번 닫으면 30일 쉰다(lib/app-install.ts).
// 위쪽에 띄운다(아래쪽은 플레이어·맞춤 정보 질문·리포트 알림 자리). 휴대폰은 '알림 받기'(스토어로), PC는 휴대폰으로 찍을 QR

const SEEN_DAY_KEY = "maengo_web_seen_day";
const kstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

type Nudge = { where: "return_next_day" | "after_listen"; title: string; sub: string };

export function WebAppNudges({ pushEnabled }: { pushEnabled: boolean }) {
  const { usesApp } = useProfile();
  const { data } = useToday();
  const { status } = usePlayer();
  const pathname = usePathname();
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const label = data.notifyLabel;
  const commute = data.slot === "pm" ? "퇴근길" : "출근길";

  const show = (n: Nudge) => {
    if (usesApp || !nudgeAllowed()) return;
    markNudgeShown();
    setNudge(n);
  };

  // 다음 날 다시 왔을 때(오늘 화면을 열 때 한 번 본다). 처음 온 날은 기록만 남긴다.
  // 지난 방문일은 한 번만 읽고(읽으며 오늘로 바꾼다), 띄우는 타이머는 효과가 다시 돌아도(개발 모드 두 번 실행) 다시 건다
  const returning = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (usesApp || pathname !== "/today") return;
    if (returning.current === undefined) {
      try {
        const prev = localStorage.getItem(SEEN_DAY_KEY);
        localStorage.setItem(SEEN_DAY_KEY, kstDay());
        returning.current = !!prev && prev < kstDay();
      } catch {
        returning.current = false;
      }
    }
    if (!returning.current) return;
    // 휴대폰 웹에서 알림을 못 받는 곳(iPhone 사파리·카카오톡 안 등)이거나 알림을 안 켰으면 '앱이었다면 받았어요', 아니면(PC 등) 휴대폰으로 받기
    const missed = isMobileWeb() && (!("PushManager" in window) || !pushEnabled);
    const t = window.setTimeout(() => {
      returning.current = false;
      show(
        missed
          ? { where: "return_next_day", title: `오늘 ${commute} 브리핑, 앱이었다면 ${label}에 알림으로 받았어요`, sub: SAME_ACCOUNT }
          : { where: "return_next_day", title: `${commute}엔 휴대폰으로 받아 보세요`, sub: `맹고 앱이 ${label}에 알려 주고, 화면을 꺼도 끝까지 들려요` },
      );
    }, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 오늘 화면을 열 때만 본다
  }, [pathname, usesApp]);

  // 브리핑을 끝까지 다 들었을 때(듣는 중 → 끝)
  const prevStatus = useRef(status);
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (was === "playing" && status === "done") {
      show({ where: "after_listen", title: `내일 ${commute}에도 알려 드릴까요?`, sub: `맹고 앱이 ${label}에 알려 줘요. ${SAME_ACCOUNT}` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 듣기 상태가 바뀔 때만 본다
  }, [status]);

  if (!nudge) return null;
  return (
    <AppNudgeToast
      where={nudge.where}
      title={nudge.title}
      sub={nudge.sub}
      onClose={() => {
        markNudgeClosed();
        setNudge(null);
      }}
    />
  );
}

/** 위쪽 앱 권유 한 장. 휴대폰 웹은 '알림 받기'(스토어로), PC는 QR */
export function AppNudgeToast({ where, title, sub, onClose, cta = "알림 받기" }: { where: string; title: string; sub: string; onClose: () => void; cta?: string }) {
  const mobile = isMobileWeb();
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-50 mx-auto max-w-[440px]">
      <div className="tile flex items-center gap-3 p-3 shadow-[0_8px_28px_rgb(31_35_64/0.18)]">
        {mobile ? <MangoIcon className="size-10 shrink-0" /> : <AppQr spot="side" size={64} />}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-snug text-balance">{title}</p>
          <p className="mt-0.5 text-[12px] font-medium leading-snug text-sub">{mobile ? sub : "휴대폰 카메라로 찍으면 앱을 받아요"}</p>
        </div>
        {mobile && (
          <a href={installHref(where)} onClick={() => track("app_install_click", { where })} className="btn btn-ink min-h-9 shrink-0 px-3.5 text-[14px]">
            {cta}
          </a>
        )}
        <button type="button" aria-label="닫기" onClick={onClose} className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full text-sub">
          <IconClose className="size-4" />
        </button>
      </div>
    </div>
  );
}
