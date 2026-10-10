"use client";

import { NOTIFY_TIMES, notifyTimeLabel } from "@maengo/core/kst";
import { useActionState } from "react";
import { saveNotifyAt } from "@/app/actions";

/** 자주 고르는 시간(출근 전, 출근길, 점심, 퇴근길, 자기 전) */
const PRESETS = ["07:00", "08:00", "12:00", "18:00", "21:00"];

/** 설정 > 알림 시간: 자주 고르는 시간은 버튼으로, 그 밖은 30분 단위 목록에서 고른다. 고르는 즉시 저장한다 */
export function NotifyTimePicker({ current }: { current: string }) {
  const [state, action, pending] = useActionState(saveNotifyAt, null);
  const value = state?.notifyAt ?? current;

  return (
    <>
      <p className="text-[15px] font-extrabold">알림 시간</p>
      <form action={action} className="mt-3">
        <div role="group" aria-label="자주 고르는 시간" className="flex flex-wrap gap-2">
          {PRESETS.map((t) => (
            <button
              key={t}
              type="submit"
              name="notifyAt"
              value={t}
              aria-pressed={value === t}
              disabled={pending}
              className={`tile min-h-11 px-3.5 text-[14px] font-extrabold ${value === t ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}
            >
              {notifyTimeLabel(t)}
            </button>
          ))}
        </div>
      </form>
      <form action={action} className="mt-3 flex items-center gap-3">
        <label htmlFor="notify-at" className="shrink-0 text-[14px] font-extrabold text-sub">
          다른 시간
        </label>
        {/* 저장된 값이 바뀌면 key로 다시 그려 목록도 그 값을 가리키게 한다 */}
        <select
          key={value}
          id="notify-at"
          name="notifyAt"
          defaultValue={value}
          disabled={pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="tile min-h-11 min-w-0 flex-1 px-3 text-[15px] font-extrabold sm:flex-none"
        >
          {NOTIFY_TIMES.map((t) => (
            <option key={t} value={t}>
              {notifyTimeLabel(t)}
            </option>
          ))}
        </select>
      </form>
      <p aria-live="polite" className="mt-3 text-[14px] font-bold text-mango-deep empty:hidden">
        {state?.error}
      </p>
    </>
  );
}
