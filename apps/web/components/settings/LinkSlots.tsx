"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { editLinks } from "@/app/actions";
import { track } from "@/lib/analytics";
import { IconCheck, IconClose } from "@/components/icons";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import type { LinkView, TopicResult } from "@/lib/types";

/**
 * 설정 > 내 관심 링크(Premium, 2026-10-15 사용자 결정: 인풋박스 칸으로 관리, 3개, 넣기 버튼 없이 적고 엔터).
 * 칸마다 주소 한 칸. 적고 엔터(키보드 완료)를 치거나 칸을 벗어나면 넣고, 넣어 둔 링크는 ✕로 뺀다. 넣어 둔 칸의 주소를 고쳐 넣으면 그 칸의 링크가 바뀐다.
 * 서버가 RSS를 찾아 글을 가져올 수 있는지 확인한다(확인 중에는 칸을 잠그고 오른쪽에 도는 표시). 되면 오른쪽에 초록 체크와 칸 아래 이름,
 * 안 되면 빨간 테두리와 칸 아래 까닭(2026-10-17 사용자 결정). 넣어 둔 링크가 계속 못 가져와도 빨간 테두리. Free는 Premium 배지.
 * 플랜 개수를 넘는 링크(Premium·체험이 끝난 뒤 남은 링크, 소식은 더 안 고른다)는 칸 아래에 Premium 배지와 빼기 버튼만 둔다.
 */
export function LinkSlots({ links, limit }: { links: LinkView[]; limit: number }) {
  const bySlot = new Map(links.map((l) => [l.slot, l]));
  const slots = Array.from({ length: Math.max(0, limit) }, (_, i) => i + 1);
  const locked = links.filter((l) => l.slot < 1 || l.slot > limit);
  return (
    <>
      {limit <= 0 && (
        <div className="flex min-h-12 items-center justify-between gap-3">
          <span className="text-sub">블로그·사이트 주소로 소식 받기</span>
          <Link href="/premium" className="no-underline" aria-label="블로그·사이트 주소로 소식 받기, Premium에서 쓸 수 있어요">
            <PremiumBadge />
          </Link>
        </div>
      )}
      {slots.length > 0 && (
        <ul className="flex flex-col gap-3">
          {slots.map((slot) => {
            const saved = bySlot.get(slot) ?? null;
            // 링크가 바뀌면(넣기·빼기 뒤) 칸을 새로 그려 입력값을 저장된 주소로 되돌린다
            return <Slot key={`${slot}:${saved?.id ?? ""}`} slot={slot} saved={saved} />;
          })}
        </ul>
      )}
      {locked.length > 0 && (
        <ul className={`flex flex-col gap-3 ${slots.length ? "mt-3" : "mt-1"}`}>
          {locked.map((l) => (
            <LockedLink key={l.id} link={l} />
          ))}
        </ul>
      )}
    </>
  );
}

/** 플랜 개수를 넘어 쉬고 있는 링크: 이름·주소와 Premium 배지, 빼기(✕). 주소는 고칠 수 없다 */
function LockedLink({ link }: { link: LinkView }) {
  const [state, formAction, pending] = useActionState<TopicResult | null, FormData>(async (prev, formData) => {
    const r = await editLinks(prev, formData);
    track("link_edit", { action: "remove" });
    return r;
  }, null);
  return (
    <li>
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="removeLink" value={link.id} />
        <div className="tile flex min-h-12 min-w-0 flex-1 items-center gap-2 bg-snow px-4">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-faint">{link.siteUrl}</span>
          <Link href="/premium" className="no-underline" aria-label={`${link.name}, Premium에서 다시 받을 수 있어요`}>
            <PremiumBadge />
          </Link>
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-label={`${link.name} 빼기`}
          className="tile flex size-12 shrink-0 items-center justify-center text-sub hover:bg-snow disabled:opacity-40"
        >
          <IconClose className="size-4 [stroke-width:2.6]" />
        </button>
      </form>
      <p className="mt-1 truncate px-1 text-[13px] font-bold text-faint">{link.name}</p>
      <p aria-live="polite" className="mt-1 px-1 text-[13px] font-bold text-cherry empty:hidden">
        {!pending && state?.tone === "warn" ? state.message : ""}
      </p>
    </li>
  );
}

function Slot({ slot, saved }: { slot: number; saved: LinkView | null }) {
  const [value, setValue] = useState(saved?.siteUrl ?? "");
  // 마지막으로 확인을 보낸 주소. 이번 결과(체크·빨간 테두리)는 칸의 주소가 이것과 같을 때만 보인다
  const [tried, setTried] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<TopicResult | null, FormData>(async (prev, formData) => {
    const r = await editLinks(prev, formData);
    // 분석: 넣었는지·뺐는지·막혔는지와 까닭만(주소는 남기지 않는다)
    if (formData.has("removeLink")) track("link_edit", { action: "remove" });
    else track("link_edit", r?.tone === "warn" ? { action: "fail", reason: r.code ?? "limit" } : { action: "add" });
    return r;
  }, null);
  const id = `link-slot-${slot}`;
  const text = value.trim();
  // 이번에 확인한 결과가 먼저, 아니면 넣어 둔 링크 그대로일 때 그 링크의 수집 상태
  const status: "checking" | "ok" | "error" | null = pending
    ? "checking"
    : state && text && text === tried
      ? state.tone === "warn"
        ? "error"
        : "ok"
      : saved && text === saved.siteUrl
        ? saved.failing
          ? "error"
          : "ok"
        : null;
  // 까닭 문구도 이번 주소의 결과일 때만(확인 중이거나 주소를 고치면 지난 까닭은 숨긴다). 빼기가 막힌 까닭은 그대로
  const warning = !pending && state?.tone === "warn" && (tried === null || text === tried) ? state.message : "";
  return (
    <li>
      {/* 주소 검사는 서버가 한다(https:// 없는 주소도 받는다). 브라우저 검사는 그런 주소의 제출을 막고 blur 때 칸으로 포커스를 되돌린다 */}
      <form
        noValidate
        action={formAction}
        onSubmit={(e) => {
          // 빈 칸에서 엔터는 아무것도 하지 않는다. 넣어 둔 주소 그대로 엔터도 마찬가지
          if (!text || text === saved?.siteUrl) e.preventDefault();
          else setTried(text);
        }}
        className="flex gap-2"
      >
        <input type="hidden" name="slot" value={slot} />
        <label htmlFor={id} className="sr-only">
          내 관심 링크 {slot}
        </label>
        <div className="relative min-w-0 flex-1">
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
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={(e) => {
              // 칸을 벗어나면 엔터와 같다. 방금 확인한 주소는 다시 보내지 않고(다시 해 보려면 엔터), 비우고 나가면 넣어 둔 주소로 되돌린다
              if (pending) return;
              if (!text) {
                if (saved) setValue(saved.siteUrl);
                return;
              }
              if (text !== tried) e.currentTarget.form?.requestSubmit();
            }}
            placeholder="블로그·사이트 주소"
            disabled={pending}
            aria-invalid={status === "error" || undefined}
            aria-describedby={`${id}-msg`}
            className={`tile min-h-12 w-full px-4 pr-11 text-[15px] font-semibold placeholder:text-faint disabled:opacity-60 ${status === "error" ? "border-cherry" : ""}`}
          />
          {status === "checking" && (
            <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-line border-t-sub motion-safe:animate-spin" />
          )}
          {status === "ok" && (
            <span role="img" aria-label="가져올 수 있어요" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-leaf">
              <IconCheck className="size-5 [stroke-width:3]" />
            </span>
          )}
        </div>
        {/* 빼기는 엔터(폼 제출)와 따로 보낸다. submit 버튼이면 엔터가 이 버튼으로 제출돼 링크가 빠진다.
            누를 때 칸에서 포커스가 빠지지 않게 해서, 고치던 주소가 blur로 먼저 넣어지지 않게 한다 */}
        {saved && (
          <button
            type="button"
            disabled={pending}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setTried(null);
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
      {saved && !warning && (
        <p className="mt-1 truncate px-1 text-[13px] font-bold text-faint">
          {saved.name}
          {saved.failing ? <span className="text-cherry"> · 가져오지 못함</span> : saved.lastItemLabel ? ` · 마지막 글 ${saved.lastItemLabel}` : ""}
        </p>
      )}
      <p id={`${id}-msg`} aria-live="polite" className="mt-1 px-1 text-[13px] font-bold text-cherry empty:hidden">
        {warning}
      </p>
    </li>
  );
}
