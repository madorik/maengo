"use client";

import { useActionState } from "react";
import { editTopics } from "@/app/actions";
import { IconClose, IconPlus } from "@/components/icons";
import type { TopicGroupView, UserTopic } from "@/lib/types";

/**
 * 설정 > 관심사: 빼기(×), 문장으로 추가, 분류별로 더하기. 세 폼이 같은 액션과 안내 문구를 쓴다.
 * 큰 분류(백엔드·주식 등)는 그 분야를 넓게, 상세 관심사(PostgreSQL·미국 주식 등)는 그 주제를 더 자주 고르게 한다.
 */
export function TopicEditor({ topics, groups, limit }: { topics: UserTopic[]; groups: TopicGroupView[]; limit: number }) {
  const [state, action, pending] = useActionState(editTopics, null);
  const last = topics.length <= 1;

  return (
    <>
      <p className="text-sub">고른 관심사에서 매일 소식을 골라요. 바꾼 내용은 내일 아침 피드부터 반영돼요.</p>

      <div className="mt-5 flex items-baseline justify-between">
        <h3 className="text-[15px] font-black">내 관심사</h3>
        <span className={`font-round text-[14px] font-black ${topics.length > limit ? "text-mango-deep" : "text-sub"}`}>
          {topics.length}/{limit}
          {topics.length > limit && <span className="sr-only"> 한도를 넘었어요</span>}
        </span>
      </div>
      <form action={action}>
        <ul className="mt-2 flex flex-wrap gap-2">
          {topics.map((t) => (
            <li key={t.id} className="tile inline-flex items-center gap-0.5 py-1 pl-3.5 pr-1 text-[14px] font-extrabold">
              {t.name}
              <button
                type="submit"
                name="remove"
                value={t.id}
                disabled={pending || last}
                aria-label={`${t.name} 빼기`}
                title={last ? "관심사가 하나는 있어야 해요" : `${t.name} 빼기`}
                className="flex size-8 items-center justify-center rounded-lg text-faint hover:bg-snow hover:text-ink disabled:opacity-40"
              >
                <IconClose className="size-4 [stroke-width:2.6]" />
              </button>
            </li>
          ))}
        </ul>
      </form>
      <p aria-live="polite" className={`mt-3 min-h-5 text-[14px] font-bold ${state?.tone === "warn" ? "text-mango-deep" : "text-leaf"}`}>
        {state?.message}
      </p>

      <form action={action} className="mt-3">
        <label htmlFor="topic-text" className="text-[15px] font-black">
          직접 입력해 더하기
        </label>
        <p id="topic-text-hint" className="mt-0.5 text-[13px] font-semibold text-sub">
          적은 그대로 내 관심사에 올라가요. 쉼표로 나누면 한 번에 세 개까지. 예: 드론, 전기차
        </p>
        <div className="mt-2 flex gap-2">
          <input
            id="topic-text"
            name="text"
            required
            maxLength={200}
            autoComplete="off"
            aria-describedby="topic-text-hint"
            placeholder="예: 드론, 미국 주식"
            className="tile min-h-12 min-w-0 flex-1 px-4 text-[15px] font-semibold placeholder:text-faint"
          />
          <button type="submit" disabled={pending} className="btn min-h-12 shrink-0 px-5">
            {pending ? "더하는 중" : "추가"}
          </button>
        </div>
      </form>

      <form action={action} className="mt-7">
        <h3 className="text-[15px] font-black">관심사 더하기</h3>
        <p className="mt-0.5 text-[13px] font-semibold text-sub">분야 전체를 고르면 넓게, 상세 관심사를 더하면 그 주제를 더 자주 골라 드려요.</p>
        <div className="mt-3 flex flex-col gap-4">
          {groups.map((g) => {
            const rest = g.details.filter((d) => !d.picked);
            return (
              <section key={g.id} aria-labelledby={`group-${g.id}`}>
                <div className="flex items-center gap-2">
                  <h4 id={`group-${g.id}`} className="text-[14px] font-black">
                    {g.name}
                  </h4>
                  {g.picked ? (
                    <span className="text-[12px] font-extrabold text-leaf">분야 전체를 받고 있어요</span>
                  ) : (
                    <button
                      type="submit"
                      name="add"
                      value={g.id}
                      disabled={pending}
                      aria-label={`${g.name} 분야 전체 더하기`}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-extrabold text-sky hover:bg-sky-tint"
                    >
                      <IconPlus className="size-3.5 [stroke-width:2.8]" />
                      분야 전체
                    </button>
                  )}
                </div>
                {rest.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {rest.map((d) => (
                      <li key={d.id}>
                        <button
                          type="submit"
                          name="add"
                          value={d.id}
                          disabled={pending}
                          aria-label={`${d.name} 더하기`}
                          className="tile inline-flex min-h-10 items-center gap-1 px-3 text-[14px] font-extrabold text-sub hover:bg-snow hover:text-ink"
                        >
                          <IconPlus className="size-4 text-sky [stroke-width:2.6]" />
                          {d.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </form>
    </>
  );
}
