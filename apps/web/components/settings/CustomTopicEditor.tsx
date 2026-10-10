"use client";

import { useActionState } from "react";
import { editTopics } from "@/app/actions";
import type { UserTopic } from "@/lib/types";
import { Count, RemovableChips } from "./TopicEditor";

/**
 * 설정 > 관심사 > 기타: 목록에 없는 관심사를 직접 적어 넣는다(Free 1개, Premium 10개, 목록 관심사와 따로 센다).
 * 온보딩의 기타와 같다. 분야 목록(TopicEditor) 바로 아래에 붙어 마지막 분류처럼 보인다.
 * 목록에 있는 말을 적으면 서버가 목록 관심사로 넣고 그렇게 알려 준다.
 */
export function CustomTopicEditor({ items, limit, last }: { items: UserTopic[]; limit: number; last: boolean }) {
  const [state, action, pending] = useActionState(editTopics, null);

  return (
    <section aria-labelledby="group-etc" className="mt-4">
      <div className="flex items-baseline justify-between">
        <h4 id="group-etc" className="text-[14px] font-black">
          기타
        </h4>
        <Count used={items.length} limit={limit} />
      </div>
      <p className="mt-0.5 text-[13px] font-semibold text-sub">목록에 없는 관심사를 직접 적어요.</p>
      {items.length > 0 && (
        <form action={action}>
          <RemovableChips items={items} pending={pending} last={last} />
        </form>
      )}
      <form action={action} className="mt-2">
        <label htmlFor="etc-text" className="sr-only">
          기타에 넣을 관심사
        </label>
        <div className="flex gap-2">
          <input
            id="etc-text"
            name="text"
            required
            maxLength={200}
            autoComplete="off"
            placeholder="예: 드론, 반도체, 게임"
            className="tile min-h-12 min-w-0 flex-1 px-4 text-[15px] font-semibold placeholder:text-faint"
          />
          <button type="submit" disabled={pending} className="btn min-h-12 shrink-0 px-5">
            {pending ? "넣는 중" : "넣기"}
          </button>
        </div>
      </form>
      <p aria-live="polite" className={`mt-3 min-h-5 text-[14px] font-bold ${state?.tone === "warn" ? "text-mango-deep" : "text-leaf"}`}>
        {state?.message}
      </p>
    </section>
  );
}
