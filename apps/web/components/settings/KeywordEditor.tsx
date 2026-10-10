"use client";

import { useActionState } from "react";
import { editTopics } from "@/app/actions";
import type { UserTopic } from "@/lib/types";
import { Count, RemovableChips } from "./TopicEditor";

/**
 * 설정 > 키워드: 관심사 목록에 없는 말을 직접 적어 넣는다(Free 1개, Premium 10개, 관심사와 따로 센다).
 * 목록에 있는 말을 적으면 서버가 관심사로 넣고 그렇게 알려 준다.
 */
export function KeywordEditor({ keywords, limit }: { keywords: UserTopic[]; limit: number }) {
  const [state, action, pending] = useActionState(editTopics, null);

  return (
    <>
      <p className="text-sub">관심사 목록에 없는 말을 적어 두면 그 말이 나오는 소식도 골라 드려요.</p>

      <div className="mt-5 flex items-baseline justify-between">
        <h3 className="text-[15px] font-black">내 키워드</h3>
        <Count used={keywords.length} limit={limit} />
      </div>
      {keywords.length > 0 ? (
        <form action={action}>
          <RemovableChips items={keywords} pending={pending} />
        </form>
      ) : (
        <p className="mt-1 text-[14px] font-semibold text-faint">아직 넣은 키워드가 없어요.</p>
      )}

      <form action={action} className="mt-4">
        <label htmlFor="keyword-text" className="sr-only">
          넣을 키워드
        </label>
        <div className="flex gap-2">
          <input
            id="keyword-text"
            name="text"
            required
            maxLength={200}
            autoComplete="off"
            placeholder="예: 드론, 전기차"
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
    </>
  );
}
