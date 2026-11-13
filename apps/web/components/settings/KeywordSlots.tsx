"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { editTopics } from "@/app/actions";
import { track } from "@/lib/analytics";
import { IconClose } from "@/components/icons";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { useToast } from "@/components/ui/Toast";
import type { TopicResult, UserTopic } from "@/lib/types";

const send = (prev: TopicResult | null, fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return editTopics(prev, fd);
};

/**
 * 내 관심 키워드 > 내 키워드(2026-11-08, 예전 설정 > 관심사의 '기타'). 목록에 없는 관심사를 직접 적는 칸. Premium 10개(plans.custom_limit), Free 0개.
 * 내 관심 링크(LinkSlots)처럼 키워드마다 인풋박스 한 칸. 칸의 글을 고치고 엔터(키보드 완료)를 치거나 칸을 벗어나면 그 키워드가 바뀌고, ✕로 뺀다(되돌리기 알림).
 * 아래 빈칸에 적으면 새로 넣는다(쉼표로 여러 개). 목록에 있는 말('반도체')이면 위 관심 분야로 들어간다(서버 addCustomTopics).
 * 플랜 개수를 넘는 키워드(Free가 전에 넣어 둔 것)는 고칠 수 없고 Premium 배지와 빼기만 둔다.
 */
export function KeywordSlots({ keywords, limit, total }: { keywords: UserTopic[]; limit: number; total: number }) {
  const editable = keywords.slice(0, Math.max(0, limit));
  const locked = keywords.slice(Math.max(0, limit));
  // 하나 남은 관심사는 뺄 수 없다(관심 분야까지 합쳐서, 서버도 막는다)
  const last = total <= 1;
  const toast = useToast();
  // 되돌리기는 칸이 사라진 뒤에 눌린다: 여기서 적은 말로 다시 넣는다(같은 말이면 같은 키워드가 된다)
  const [undoState, undo] = useActionState<TopicResult | null, string>((prev, name) => send(prev, { text: name }), null);
  const removed = (name: string) => toast.showUndo({ label: "뺐어요", onUndo: () => startTransition(() => undo(name)) });

  return (
    <>
      {/* 2026-11-13 사용자: 키워드는 오늘 소식과 이어질 때 그 키워드에 미칠 영향을 맞춤 인사이트로 주는 용도(lib/server/briefing-insight.ts 근거 K) */}
      <p className="mb-3 px-1 text-[14px] font-medium leading-snug text-sub">오늘 소식이 내 키워드와 이어지면, 그 키워드에 어떤 영향인지 맞춤 인사이트로 짚어 드려요.</p>
      {limit <= 0 && (
        <div className="flex min-h-12 items-center justify-between gap-3">
          <span className="text-sub">목록에 없는 키워드 넣기</span>
          <Link href="/premium" className="no-underline" aria-label="목록에 없는 키워드 넣기, Premium에서 쓸 수 있어요">
            <PremiumBadge />
          </Link>
        </div>
      )}
      {limit > 0 && (
        <ul className="flex flex-col gap-3">
          {editable.map((k) => (
            <Row key={k.id} keyword={k} last={last} onRemoved={removed} />
          ))}
          {/* 빈칸은 키워드가 바뀌면(넣기 뒤) 새로 그려 비운다. 막혔으면 그대로 두고 까닭을 보인다 */}
          {editable.length < limit && <Row key={`add:${keywords.map((k) => k.id).join(",")}`} keyword={null} last={last} onRemoved={removed} />}
        </ul>
      )}
      {locked.length > 0 && (
        <ul className={`flex flex-col gap-3 ${limit > 0 ? "mt-3" : "mt-1"}`}>
          {locked.map((k) => (
            <LockedRow key={k.id} keyword={k} last={last} onRemoved={removed} />
          ))}
        </ul>
      )}
      <p aria-live="polite" className="mt-2 px-1 text-[13px] font-bold text-cherry empty:hidden">
        {undoState?.tone === "warn" ? undoState.message : ""}
      </p>
    </>
  );
}

type RowProps = { last: boolean; onRemoved: (name: string) => void };

/** 빼기(✕). 누를 때 칸에서 포커스가 빠지지 않게 해서, 고치던 글이 blur로 먼저 저장되지 않게 한다 */
function RemoveButton({ name, disabled, onClick }: { name: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={`${name} 빼기`}
      className="tile flex size-12 shrink-0 items-center justify-center text-sub hover:bg-snow disabled:opacity-40"
    >
      <IconClose className="size-4 [stroke-width:2.6]" />
    </button>
  );
}

/** 키워드 한 칸. keyword가 없으면 새로 넣는 빈칸 */
function Row({ keyword, last, onRemoved }: RowProps & { keyword: UserTopic | null }) {
  const saved = keyword?.name ?? "";
  const [value, setValue] = useState(saved);
  // 마지막으로 보낸 글. 까닭(빨간 글)은 칸의 글이 이것과 같을 때만 보인다
  const [tried, setTried] = useState<string | null>(null);
  const [state, act, pending] = useActionState<TopicResult | null, Record<string, string>>(async (prev, fields) => {
    const r = await send(prev, fields);
    // 분석: 무엇을 했는지만(적은 말은 남기지 않는다)
    if ("remove" in fields) {
      track("topic_edit", { action: "remove", topic: "custom" });
      if (r?.tone !== "warn") onRemoved(saved);
    } else {
      track("topic_edit", { action: fields.rename ? "rename" : "text" });
      // 빈칸에서 넣은 말이 목록에 있는 관심사면 키워드 칸 수가 그대로라 칸이 새로 그려지지 않는다: 직접 비운다
      if (!keyword && r?.tone !== "warn") {
        setValue("");
        setTried(null);
      }
    }
    return r;
  }, null);
  const text = value.trim();
  const id = keyword ? `keyword-${keyword.id}` : "keyword-new";
  // 막힌 까닭, 또는 일부만 들어갔을 때의 한도 안내(tone ok에 문구가 붙어 온다)
  const warning = !pending && state?.message && (tried === null || text === tried) ? state.message : "";
  const blocked = !!warning && state?.tone === "warn";
  const submit = () => {
    if (!text || text === saved) return;
    setTried(text);
    startTransition(() => act(keyword ? { text, rename: keyword.id } : { text }));
  };
  return (
    <li>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2"
      >
        <label htmlFor={id} className="sr-only">
          {keyword ? `내 키워드 ${saved}` : "새 키워드"}
        </label>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            autoComplete="off"
            enterKeyHint="done"
            maxLength={200}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => {
              // 칸을 벗어나면 엔터와 같다. 방금 보낸 글은 다시 보내지 않고(다시 해 보려면 엔터), 비우고 나가면 원래 키워드로 되돌린다
              if (pending) return;
              if (!text) {
                setValue(saved);
                return;
              }
              if (text !== tried) submit();
            }}
            placeholder={keyword ? undefined : "키워드(예: 삼성전자, 변동금리, 전기차)"}
            disabled={pending}
            aria-invalid={blocked || undefined}
            aria-describedby={`${id}-msg`}
            className={`tile min-h-12 w-full px-4 pr-11 text-[16px] font-semibold placeholder:text-faint disabled:opacity-60 ${blocked ? "border-cherry" : ""}`}
          />
          {pending && (
            <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-line border-t-sub motion-safe:animate-spin" />
          )}
        </div>
        {keyword && (
          <RemoveButton
            name={saved}
            disabled={pending || last}
            onClick={() => {
              setTried(null);
              startTransition(() => act({ remove: keyword.id }));
            }}
          />
        )}
      </form>
      <p id={`${id}-msg`} aria-live="polite" className="mt-1 px-1 text-[13px] font-bold text-cherry empty:hidden">
        {warning}
      </p>
    </li>
  );
}

/** 플랜 개수를 넘어 쉬고 있는 키워드: 글과 Premium 배지, 빼기(✕). 글은 고칠 수 없다 */
function LockedRow({ keyword, last, onRemoved }: RowProps & { keyword: UserTopic }) {
  const [state, act, pending] = useActionState<TopicResult | null, string>(async (prev, topicId) => {
    const r = await send(prev, { remove: topicId });
    track("topic_edit", { action: "remove", topic: "custom" });
    if (r?.tone !== "warn") onRemoved(keyword.name);
    return r;
  }, null);
  return (
    <li>
      <div className="flex gap-2">
        <div className="tile flex min-h-12 min-w-0 flex-1 items-center gap-2 bg-snow px-4">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-faint">{keyword.name}</span>
          <Link href="/premium" className="no-underline" aria-label={`${keyword.name}, Premium에서 다시 받을 수 있어요`}>
            <PremiumBadge />
          </Link>
        </div>
        <RemoveButton name={keyword.name} disabled={pending || last} onClick={() => startTransition(() => act(keyword.id))} />
      </div>
      <p aria-live="polite" className="mt-1 px-1 text-[13px] font-bold text-cherry empty:hidden">
        {!pending && state?.tone === "warn" ? state.message : ""}
      </p>
    </li>
  );
}
