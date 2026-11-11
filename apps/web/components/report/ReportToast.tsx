"use client";

import { kstDate } from "@maengo/core/kst";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useContextToastOpen } from "@/components/context/ContextAsk";
import { IconChevronRight, IconClose, IconTrendUp } from "@/components/icons";

// '지난주 리포트가 나왔어요'(2026-11-11 사용자: 오늘 화면 맨 위 카드가 자리를 먹어 다른 카드가 밀린다 → 아래쪽 알림으로).
// - 오늘 화면에서만, 아직 안 연 리포트가 있을 때(ReportBanner가 서버에서 고른다). 누르면 그 리포트, 열면 서버가 seen_at을 남겨 다시 안 뜬다
// - 이 기기에서 하루 한 번. 10초 동안 손대지 않으면 저절로 닫힌다. ✕는 그 리포트 알림을 다시 띄우지 않는다
// - 맞춤 정보 질문 알림(같은 자리)이 떠 있으면 그게 닫힐 때까지 기다린다

const KEY = "maengo_report_toast";

function readKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function writeKey(v: string) {
  try {
    localStorage.setItem(KEY, v);
  } catch {}
}
const noSubscribe = () => () => {};

export function ReportToast({ start, title, headline }: { start: string; title: string; headline: string }) {
  // 띄울지는 처음 그릴 때 한 번만 정한다(띄우면서 '오늘 보였음'으로 남겨도 스스로 사라지지 않게)
  const decided = useRef<boolean | null>(null);
  const can = useSyncExternalStore(
    noSubscribe,
    () => (decided.current ??= ![`${start}|${kstDate()}`, `${start}|closed`].includes(readKey() ?? "")),
    () => false,
  );
  const waiting = useContextToastOpen();
  const [open, setOpen] = useState(true);
  const [touched, setTouched] = useState(false);
  const show = can && open && !waiting;

  useEffect(() => {
    if (!show) return;
    writeKey(`${start}|${kstDate()}`);
    if (touched) return;
    const t = window.setTimeout(() => setOpen(false), 10_000);
    return () => window.clearTimeout(t);
  }, [show, touched, start]);

  if (!show) return null;
  return (
    <div
      role="region"
      aria-label="주간 리포트 알림"
      onPointerDown={() => setTouched(true)}
      className="rise keep-light fixed inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[420px] items-center gap-1 rounded-[20px] bg-[#1F2340] py-2 pl-2 pr-1 text-white shadow-[0_12px_32px_rgb(31_35_64/0.3)] lg:bottom-28"
    >
      <Link href={`/report?d=${start}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] py-1 pl-1 pr-1 text-white no-underline">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mango text-[#1F2340]">
          <IconTrendUp className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold tracking-[-0.02em]">{title}</span>
          {headline && <span className="mt-0.5 block truncate text-[13px] font-medium text-white/70">{headline}</span>}
        </span>
        <IconChevronRight className="size-5 shrink-0 text-white/50" />
      </Link>
      <button
        type="button"
        aria-label="리포트 알림 닫기"
        onClick={() => {
          writeKey(`${start}|closed`);
          setOpen(false);
        }}
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-white/60"
      >
        <IconClose className="size-4" />
      </button>
    </div>
  );
}
