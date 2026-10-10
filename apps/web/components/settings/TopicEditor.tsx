"use client";

import { useActionState } from "react";
import { editTopics } from "@/app/actions";
import { IconClose, IconPlus } from "@/components/icons";
import type { TopicGroupView, UserTopic } from "@/lib/types";

/** 빼기(×) 버튼이 붙은 칩 목록. 목록 관심사와 기타가 같이 쓴다. last면 기타까지 합쳐 하나뿐이라 못 뺀다 */
export function RemovableChips({ items, pending, last }: { items: UserTopic[]; pending: boolean; last: boolean }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((t) => (
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
  );
}

/** n/한도. 넘거나 차면 주황으로 */
export function Count({ used, limit }: { used: number; limit: number }) {
  return (
    <span className={`font-round text-[14px] font-black ${used >= limit ? "text-mango-deep" : "text-sub"}`}>
      {used}/{limit}
      {used > limit && <span className="sr-only"> 한도를 넘었어요</span>}
    </span>
  );
}

/**
 * 설정 > 관심사: 목록에서 고른 관심사 빼기(×)와 분류별로 더하기. 두 폼이 같은 액션과 안내 문구를 쓴다.
 * 큰 분류(백엔드·주식 등)는 그 분야를 넓게, 상세 관심사(PostgreSQL·미국 주식 등)는 그 주제를 더 자주 고르게 한다.
 * 목록에 없는 관심사는 바로 아래 기타(CustomTopicEditor)에 적는다.
 */
export function TopicEditor({ topics, groups, limit, last }: { topics: UserTopic[]; groups: TopicGroupView[]; limit: number; last: boolean }) {
  const [state, action, pending] = useActionState(editTopics, null);

  return (
    <>
      <p className="text-sub">고른 관심사로 매일 소식을 골라요. 목록에 없으면 맨 아래 기타에 적어 주세요. 바꾼 내용은 내일 아침 피드부터 반영돼요.</p>

      <div className="mt-5 flex items-baseline justify-between">
        <h3 className="text-[15px] font-black">내 관심사</h3>
        <Count used={topics.length} limit={limit} />
      </div>
      {topics.length > 0 ? (
        <form action={action}>
          <RemovableChips items={topics} pending={pending} last={last} />
        </form>
      ) : (
        <p className="mt-1 text-[14px] font-semibold text-faint">아직 고른 관심사가 없어요. 아래에서 더해 보세요.</p>
      )}
      <p aria-live="polite" className={`mt-3 min-h-5 text-[14px] font-bold ${state?.tone === "warn" ? "text-mango-deep" : "text-leaf"}`}>
        {state?.message}
      </p>

      <form action={action} className="mt-3">
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
