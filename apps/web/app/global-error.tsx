"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { PAPER } from "@/lib/theme";

/** 맨 바깥 레이아웃까지 깨졌을 때. 전역 스타일이 없어 인라인으로 그린다(색은 OS 다크 모드를 따른다) */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: `light-dark(${PAPER.light}, ${PAPER.dark})`,
          color: "light-dark(#1F2340, #ECEEF5)",
          colorScheme: "light dark",
          textAlign: "center",
        }}
      >
        <title>맹고</title>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>화면을 불러오지 못했어요</h1>
        <button
          type="button"
          onClick={retry}
          style={{ minHeight: 48, padding: "0 24px", border: 0, borderRadius: 16, background: "#1A8FE0", color: "#fff", fontSize: 16, fontWeight: 800 }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
