"use client";

import { signOut } from "@/app/actions";
import { IconChevronRight } from "@/components/icons";
import { isAppUserAgent } from "@/lib/app-client";
import { unregisterThisBrowser } from "@/lib/web-push";

/**
 * 설정 > 계정 > 로그아웃(2026-11-26 메뉴를 아래로 내림). 모바일 위쪽 프로필 사진(계정 메뉴)이 없어져서 설정에 둔다. 하는 일은 AccountMenu와 같다.
 * 로그아웃 전에 이 기기(앱)·이 브라우저(웹 푸시)의 알림 토큰을 지운다(다음 사람이 여기서 로그인해도 앞사람 알림이 오지 않게)
 */
export function LogoutRow() {
  const logout = async () => {
    if (isAppUserAgent(navigator.userAgent)) {
      await (await import("@/lib/native/push")).unregisterApp();
      // 홈 화면 위젯도 앞사람 소식을 보이지 않게
      await (await import("@/lib/native/widget")).clearWidget();
    } else await unregisterThisBrowser();
    await signOut();
  };
  return (
    <form action={logout}>
      <button type="submit" className="flex min-h-12 w-full items-center justify-between gap-3 text-left font-bold text-ink hover:underline">
        로그아웃
        <IconChevronRight className="size-4 text-sub" />
      </button>
    </form>
  );
}
