"use client";

import { NOTIFY_TIMES, notifyTimeLabel } from "@maengo/core/kst";
import { useActionState } from "react";
import { saveNotifyAt } from "@/app/actions";

/** 설정 > 알림 시간: 30분 단위 목록 하나. 고르는 즉시 저장한다 */
export function NotifyTimePicker({ current }: { current: string }) {
  const [state, action, pending] = useActionState(saveNotifyAt, null);
  const value = state?.notifyAt ?? current;

  return (
    <>
      <form action={action} className="flex items-center justify-between gap-3">
        <label htmlFor="notify-at" className="text-[15px] font-extrabold">
          알림 시간
        </label>
        {/* 저장된 값이 바뀌면 key로 다시 그려 목록도 그 값을 가리키게 한다 */}
        <select
          key={value}
          id="notify-at"
          name="notifyAt"
          defaultValue={value}
          disabled={pending}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="tile min-h-12 w-44 shrink-0 px-3 text-[16px] font-extrabold"
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
