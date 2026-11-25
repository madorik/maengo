"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** 로그인한 화면에서 그리다 난 오류. 레이아웃(플레이어·위젯)은 그대로 두고 이 자리만 바꾼다 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex min-h-[60dvh] max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
      {/* (2026-11-25 사용자: 캐릭터 빼기) 맹고 그림 없이 글과 버튼만 */}
      <h1 className="text-[20px] font-black">화면을 불러오지 못했어요</h1>
      <button type="button" onClick={retry} className="btn btn-sky">
        다시 시도
      </button>
    </div>
  );
}
