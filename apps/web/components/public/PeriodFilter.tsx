"use client";

import Link from "next/link";
import { useState } from "react";
import { IconCalendar } from "@/components/icons";

// 소식 목록의 기간 고르기(2026-11-10 사용자 '검색 영역을 다듬어줘'). 범위 칩(분야)과 헷갈리지 않게 한 줄짜리 탭으로 두고,
// 날짜 직접은 '날짜'를 눌러야 펼친다(직접 고른 기간이면 펼친 채로). 폼은 그냥 GET이라 스크립트가 없어도 된다

const seg = "inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-[14px] font-extrabold no-underline";
const segOn = `${seg} bg-ink text-paper`;
const segOff = `${seg} text-sub hover:text-ink`;
const dateInput = "min-h-11 min-w-0 sm:w-48 rounded-xl border-2 border-line bg-paper px-2.5 text-[16px] font-bold tabular-nums text-ink";

export function PeriodFilter({
  presets,
  action,
  from,
  to,
  today,
  custom,
}: {
  presets: { label: string; href: string; on: boolean }[];
  /** 날짜 폼을 보낼 주소(basePath·#list 포함) */
  action: string;
  from?: string;
  to?: string;
  today: string;
  /** 빠른 기간이 아닌 날짜를 직접 고른 상태 */
  custom: boolean;
}) {
  const [open, setOpen] = useState(custom);
  return (
    <div className="mt-3">
      <div role="group" aria-label="기간" className="inline-flex max-w-full flex-wrap gap-0.5 rounded-2xl bg-snow p-1">
        {presets.map((p) =>
          p.on ? (
            <span key={p.label} aria-current="true" className={segOn}>
              {p.label}
            </span>
          ) : (
            <Link key={p.label} href={p.href} className={segOff}>
              {p.label}
            </Link>
          ),
        )}
        <button type="button" aria-expanded={open} aria-controls="period-custom" onClick={() => setOpen((o) => !o)} className={custom ? segOn : segOff}>
          <IconCalendar className="size-4" />
          날짜
        </button>
      </div>
      {open && (
        // 처음 펼치면 이번 달 1일 ~ 오늘을 넣어 둔다(빈 칸의 '연도. 월. 일.'이 보이지 않게)
        <form id="period-custom" action={action} className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 max-[359px]:grid-cols-1 sm:flex">
          <input type="date" name="from" aria-label="시작일" defaultValue={from ?? `${today.slice(0, 8)}01`} max={today} className={dateInput} />
          <span aria-hidden="true" className="font-bold text-faint max-[359px]:hidden">
            ~
          </span>
          <input type="date" name="to" aria-label="종료일" defaultValue={to ?? today} max={today} className={dateInput} />
          <button type="submit" className="btn col-span-full min-h-11 px-5 text-[15px]">
            보기
          </button>
        </form>
      )}
    </div>
  );
}
