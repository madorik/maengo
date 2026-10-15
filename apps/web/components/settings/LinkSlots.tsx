"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";
import { editLinks } from "@/app/actions";
import { track } from "@/lib/analytics";
import { IconClose } from "@/components/icons";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import type { LinkView, TopicResult } from "@/lib/types";

/**
 * 설정 > 내 관심 링크(Premium, 2026-10-15 사용자 결정: 인풋박스 칸으로 관리, 3개, 넣기 버튼 없이 적고 엔터).
 * 칸마다 주소 한 칸. 적고 엔터(키보드 완료)를 치면 넣고, 넣어 둔 링크는 ✕로 뺀다. 넣어 둔 칸의 주소를 고쳐 엔터를 치면 그 칸의 링크가 바뀐다.
 * 서버가 RSS를 찾아 확인한 뒤에야 칸 아래에 이름이 보이고(확인 중에는 칸을 잠근다), 막히면 그 칸 아래에 까닭만 보인다. Free는 Premium 배지.
 */
export function LinkSlots({ links, limit }: { links: LinkView[]; limit: number }) {
  if (limit <= 0) {
    return (
      <div className="flex min-h-12 items-center justify-between gap-3">
        <span className="text-sub">블로그·사이트 주소로 소식 받기</span>
        <Link href="/premium" className="no-underline" aria-label="블로그·사이트 주소로 소식 받기, Premium에서 쓸 수 있어요">
          <PremiumBadge />
        </Link>
      </div>
    );
  }
  const bySlot = new Map(links.map((l) => [l.slot, l]));
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: limit }, (_, i) => i + 1).map((slot) => {
        const saved = bySlot.get(slot) ?? null;
        // 링크가 바뀌면(넣기·빼기 뒤) 칸을 새로 그려 입력값을 저장된 주소로 되돌린다
        return <Slot key={`${slot}:${saved?.id ?? ""}`} slot={slot} saved={saved} />;
      })}
    </ul>
  );
}

function Slot({ slot, saved }: { slot: number; saved: LinkView | null }) {
  const [state, formAction, pending] = useActionState<TopicResult | null, FormData>(async (prev, formData) => {
    const r = await editLinks(prev, formData);
    // 분석: 넣었는지·뺐는지·막혔는지와 까닭만(주소는 남기지 않는다)
    if (formData.has("removeLink")) track("link_edit", { action: "remove" });
    else track("link_edit", r?.tone === "warn" ? { action: "fail", reason: r.code ?? "limit" } : { action: "add" });
    return r;
  }, null);
  const id = `link-slot-${slot}`;
  return (
    <li>
      <form
        action={formAction}
        onSubmit={(e) => {
          // 빈 칸에서 엔터는 아무것도 하지 않는다. 넣어 둔 주소 그대로 엔터도 마찬가지
          const value = (e.currentTarget.elements.namedItem("link") as HTMLInputElement | null)?.value.trim() ?? "";
          if (!value || value === saved?.siteUrl) e.preventDefault();
        }}
        className="flex gap-2"
      >
        <input type="hidden" name="slot" value={slot} />
        <label htmlFor={id} className="sr-only">
          내 관심 링크 {slot}
        </label>
        <input
          id={id}
          name="link"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          maxLength={500}
          defaultValue={saved?.siteUrl ?? ""}
          placeholder="블로그·사이트 주소"
          disabled={pending}
          className="tile min-h-12 min-w-0 flex-1 px-4 text-[15px] font-semibold placeholder:text-faint disabled:opacity-60"
        />
        {/* 빼기는 엔터(폼 제출)와 따로 보낸다. submit 버튼이면 엔터가 이 버튼으로 제출돼 링크가 빠진다 */}
        {saved && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("removeLink", saved.id);
              startTransition(() => formAction(fd));
            }}
            aria-label={`${saved.name} 빼기`}
            className="tile flex size-12 shrink-0 items-center justify-center text-sub hover:bg-snow disabled:opacity-40"
          >
            <IconClose className="size-4 [stroke-width:2.6]" />
          </button>
        )}
      </form>
      {/* 넣어 둔 링크의 이름과 마지막 글 시점. 계속 못 가져오면 그 사실. 막혔으면 까닭 */}
      {saved && state?.tone !== "warn" && (
        <p className="mt-1 truncate px-1 text-[13px] font-bold text-faint">
          {saved.name}
          {saved.failing ? <span className="text-mango-deep"> · 가져오지 못함</span> : saved.lastItemLabel ? ` · 마지막 글 ${saved.lastItemLabel}` : ""}
        </p>
      )}
      <p aria-live="polite" className="mt-1 px-1 text-[13px] font-bold text-mango-deep empty:hidden">
        {state?.tone === "warn" ? state.message : ""}
      </p>
    </li>
  );
}
