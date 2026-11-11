"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { answerContextAction, clearContextAction } from "@/app/(app)/context-actions";
import { CONTEXT_QUESTIONS, SKIP, type UserContext } from "@/lib/context";

/**
 * 내 맞춤 정보(2026-11-11): 오늘 화면 맞춤 체크에서 딸깍으로 알려 준 사정을 보고 바꾸거나 지운다('내 관심 키워드' 화면).
 * 이어 묻는 질문(국내·미국, 청약)은 앞 답이 맞을 때만 보인다. 바꾸면 다음에 오늘 화면을 열 때 맞춤 체크가 그 답으로 다시 만들어진다
 */
export function MyContext({ ctx }: { ctx: UserContext }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
    });
  const shown = CONTEXT_QUESTIONS.filter((q) => !q.after || ctx[q.after.key]?.value === q.after.value);
  return (
    <ul className="flex flex-col gap-4">
      {shown.map((q) => {
        const now = ctx[q.key]?.value;
        const answered = !!now && now !== SKIP;
        return (
          <li key={q.key}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-semibold">{q.ask}</p>
              {answered && (
                <button type="button" disabled={busy} onClick={() => run(() => clearContextAction(q.key))} className="min-h-9 px-1 text-[13px] font-semibold text-sub underline">
                  지우기
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={q.ask}>
              {q.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={busy}
                  aria-pressed={now === o.value}
                  onClick={() => run(() => answerContextAction(q.key, o.value))}
                  className={`min-h-10 rounded-full px-4 text-[14px] font-semibold ${now === o.value ? "bg-ink text-paper" : "bg-snow text-ink"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
