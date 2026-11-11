"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setPushEnabled } from "@/app/actions";
import { MangoIcon } from "@/components/MangoIcon";
import { IconClose } from "@/components/icons";
import { useToday } from "@/components/providers/TodayProvider";
import { Spinner } from "@/components/ui/Spinner";
import { track } from "@/lib/analytics";
import { registerThisBrowser } from "@/lib/web-push";

// 앱에서 알림을 안 켠 회원에게 오늘 화면에서 한 번 묻는다(2026-11-11).
// 1.3.1 안드로이드는 R8이 알림 권한 선언을 지워 온보딩에서 알림을 켜지 못했다(안드로이드 기기 등록 0건). 1.3.2로 업데이트하면 여기서 다시 켤 수 있다.
// 권한을 물을 수 있을 때만(이미 거절했거나 1.3.1이면 안 띄운다), 이 기기에서 한 번만. ✕면 다시 묻지 않는다(설정 > 알림에서 켠다)

const KEY = "maengo_app_push_offer";

export function AppPushOffer() {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useToday();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (pathname !== "/today") return;
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    let alive = true;
    const t = window.setTimeout(async () => {
      const ok = await import("@/lib/native/push").then((m) => m.canAskPush()).catch(() => false);
      if (!alive || !ok) return;
      try {
        localStorage.setItem(KEY, "1");
      } catch {}
      setShow(true);
    }, 1500);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [pathname]);

  const turnOn = () =>
    start(async () => {
      setError(null);
      const r = await registerThisBrowser();
      if (!r.ok) {
        setError(r.reason === "denied" ? "휴대폰 설정 > 앱 > 맹고 > 알림에서 허용해 주세요." : "알림을 켜지 못했어요. 설정 > 알림에서 다시 켜 주세요.");
        return;
      }
      const res = await setPushEnabled(true);
      track("notify_toggle", { on: res.enabled, where: "today_offer" });
      if (res.enabled) {
        setShow(false);
        router.refresh();
      } else setError(res.error ?? "알림을 켜지 못했어요.");
    });

  if (!show) return null;
  const commute = data.slot === "pm" ? "퇴근길" : "출근길";
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-50 mx-auto max-w-[440px]">
      <div className="tile p-3 shadow-[0_8px_28px_rgb(31_35_64/0.18)]">
        <div className="flex items-center gap-3">
          <MangoIcon className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold leading-snug text-balance">{commute} 브리핑, 알림으로 받아 볼까요?</p>
            <p className="mt-0.5 text-[12px] font-medium text-sub">{data.notifyLabel}에 알려 드려요</p>
          </div>
          <button type="button" disabled={busy} onClick={turnOn} className="btn btn-ink min-h-9 shrink-0 px-3.5 text-[14px]">
            {busy && <Spinner />}
            알림 받기
          </button>
          <button type="button" aria-label="닫기" onClick={() => setShow(false)} className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full text-sub">
            <IconClose className="size-4" />
          </button>
        </div>
        <p aria-live="polite" className="mt-2 text-[13px] font-bold text-cherry empty:hidden">
          {error}
        </p>
      </div>
    </div>
  );
}
