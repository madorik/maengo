"use client";

import { fromClock12, toClock12 } from "@maengo/core/kst";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { saveNotifyAt, type NotifyResult } from "@/app/actions";
import { WHEEL_ROW, WheelColumn } from "@/components/ui/WheelColumn";

const AMPM = ["오전", "오후"];
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
/** 바퀴가 멈춘 뒤 이만큼 더 가만히 있으면 저장한다(시·분을 이어 굴릴 때 한 번만) */
const SAVE_AFTER_MS = 600;

/** 설정 > 알림 시간: 알람처럼 오전/오후·시·분 바퀴(2026-10-17 사용자 결정). 하루 아무 때나 1분 단위, 멈추면 저장한다 */
export function NotifyTimePicker({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  const [state, action] = useActionState<NotifyResult | null, FormData>(async (prev, fd) => {
    const r = await saveNotifyAt(prev, fd);
    // 저장이 막히면 바퀴를 저장된 값으로 되돌린다
    if (r.error) setValue(r.notifyAt);
    return r;
  }, null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const change = (next: string) => {
    setValue(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const fd = new FormData();
      fd.set("notifyAt", next);
      startTransition(() => action(fd));
    }, SAVE_AFTER_MS);
  };
  const { pm, hour, minute } = toClock12(value);

  return (
    <>
      {/* 바퀴는 한 줄 전체(듣기 모드 칸과 같은 너비). iOS 알람처럼 오전/오후·시·분이 1/3씩, 콜론은 시와 분 사이 경계.
          '알림 시간' 글자는 두지 않는다(2026-10-17 사용자 결정) */}
      <div role="group" aria-label="알림 시간" className="tile relative grid grid-cols-3">
        {/* 고른 줄 띠 */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-xl bg-snow" style={{ height: WHEEL_ROW }} />
        <WheelColumn
          items={AMPM}
          index={pm ? 1 : 0}
          onChange={(i) => change(fromClock12(i === 1, hour, minute))}
          label="오전 오후"
          className="text-[16px] font-extrabold"
        />
        <WheelColumn
          items={HOURS}
          index={hour - 1}
          loop
          onChange={(i) => change(fromClock12(pm, i + 1, minute))}
          label="시"
          className="font-round text-[23px] font-black tabular-nums"
        />
        <WheelColumn
          items={MINUTES}
          index={minute}
          loop
          onChange={(i) => change(fromClock12(pm, hour, i))}
          label="분"
          className="font-round text-[23px] font-black tabular-nums"
        />
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2/3 -translate-x-1/2 -translate-y-[55%] font-round text-[21px] font-black">
          :
        </span>
      </div>
      <p aria-live="polite" className="mt-3 text-[14px] font-bold text-cherry empty:hidden">
        {state?.error}
      </p>
    </>
  );
}
