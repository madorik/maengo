"use client";

import { normalizeInterest } from "@maengo/core/topics";
import { useActionState, useId, useMemo, useRef, useState } from "react";
import { editTopics } from "@/app/actions";
import { IconCheck, IconChevronDown, IconClose, IconPlus, IconSearch } from "@/components/icons";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import type { TopicGroupView, TopicResult, TopicSuggestion, UserTopic } from "@/lib/types";

type Section = { id: string; name: string; picked: boolean };
/** 결과 안내 + 잘 들어간 횟수(찾기 칸을 비우는 데 쓴다. 막혔을 때는 적던 글자를 남긴다) */
type State = (TopicResult & { okSeq: number }) | null;

/**
 * 설정 > 관심사(2026-10-11 개편). 설정 앱처럼 고른 것만 한 줄씩 요약해 보여 주고, 줄을 누르면 그 자리에서 펼쳐 고친다.
 * - 내 관심사: 고른 분야마다 한 줄(아이콘 · 이름 · 고른 것 요약). 펼치면 체크 목록(분야 전체 + 상세 관심사)과 '이 분야 빼기'.
 *   뉴스 헤드라인은 한 줄에 6개 분야, 기타는 적은 말 목록. 한 번에 한 줄만 펼친다(details name).
 *   분야 전체와 상세 관심사는 따로 켠다(둘 다 켜면 상세 소식이 더 자주 나온다).
 * - 더하기: 찾기 칸(사전 자동 완성, 없는 말은 기타로) + 아직 안 고른 분야.
 */
export function TopicSettings({
  groups,
  news,
  custom,
  limit,
  suggestions,
}: {
  groups: TopicGroupView[];
  news: Section[];
  custom: UserTopic[];
  limit: number;
  suggestions: TopicSuggestion[];
}) {
  const [state, action, pending] = useActionState<State, FormData>(async (prev, formData) => {
    const r = await editTopics(prev, formData);
    return r ? { ...r, okSeq: (prev?.okSeq ?? 0) + (r.tone === "warn" ? 0 : 1) } : prev;
  }, null);

  const myGroups = groups.filter((g) => g.picked || g.details.some((d) => d.picked));
  const restGroups = groups.filter((g) => !myGroups.includes(g));
  const myNews = news.filter((n) => n.picked);
  const picked = new Set([...myGroups.flatMap((g) => [...(g.picked ? [g.id] : []), ...g.details.filter((d) => d.picked).map((d) => d.id)]), ...myNews.map((n) => n.id)]);
  const total = picked.size + custom.length;
  const only = total <= 1;

  return (
    <>
      {total > 0 && (
        <>
          <div className="flex items-baseline justify-between">
            <h3 className="text-[15px] font-black">내 관심사</h3>
            <Count used={picked.size} limit={limit} />
          </div>
          <form action={action} className={`tile mt-3 divide-y-2 divide-line overflow-hidden ${pending ? "opacity-70" : ""}`}>
            {myGroups.map((g) => {
              const on = [...(g.picked ? [`${g.name} 전체`] : []), ...g.details.filter((d) => d.picked).map((d) => d.name)];
              return (
                <Row key={g.id} id={g.id} title={g.name} summary={on.join(" · ")} removeLabel="이 분야 빼기" removable={!pending && on.length < total}>
                  <CheckRow id={g.id} label={`${g.name} 전체`} on={g.picked} disabled={pending || (g.picked && only)} />
                  <hr aria-hidden className="ml-[68px] mr-4 border-t-2 border-line" />
                  {g.details.map((d) => (
                    <CheckRow key={d.id} id={d.id} label={d.name} on={d.picked} disabled={pending || (d.picked && only)} />
                  ))}
                </Row>
              );
            })}
            {myNews.length > 0 && (
              <Row id="news" title="뉴스 헤드라인" summary={myNews.map((n) => n.name).join(" · ")} removeLabel="뉴스 헤드라인 빼기" removable={!pending && myNews.length < total}>
                {news.map((n) => (
                  <CheckRow key={n.id} id={n.id} label={n.name} on={n.picked} disabled={pending || (n.picked && only)} />
                ))}
              </Row>
            )}
            {custom.length > 0 && (
              <Row id="etc" title="기타" summary={custom.map((t) => t.name).join(" · ")} removeLabel="기타 모두 빼기" removable={!pending && custom.length < total}>
                {custom.map((t) => (
                  <div key={t.id} className="flex min-h-12 items-center gap-3 pl-[68px] pr-2 text-[15px] font-extrabold">
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <button
                      type="submit"
                      name="remove"
                      value={t.id}
                      disabled={pending || only}
                      aria-label={`${t.name} 빼기`}
                      className="flex size-10 items-center justify-center rounded-lg text-faint hover:bg-snow hover:text-ink disabled:opacity-40"
                    >
                      <IconClose className="size-4 [stroke-width:2.6]" />
                    </button>
                  </div>
                ))}
              </Row>
            )}
          </form>
          <p aria-live="polite" className="mt-2 text-[14px] font-bold text-mango-deep empty:hidden">
            {state?.message}
          </p>
        </>
      )}

      <h3 className={`text-[15px] font-black ${total > 0 ? "mt-7" : ""}`}>더하기</h3>
      <div className="mt-3">
        <TopicSearch key={state?.okSeq ?? 0} action={action} pending={pending} suggestions={suggestions.filter((s) => !picked.has(s.id))} />
      </div>
      {total === 0 && (
        <p aria-live="polite" className="mt-2 text-[14px] font-bold text-mango-deep empty:hidden">
          {state?.message}
        </p>
      )}
      {(restGroups.length > 0 || myNews.length === 0) && (
        <form action={action} className="mt-3">
          {restGroups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {restGroups.map((g) => (
                <AddButton key={g.id} id={g.id} name={g.name} ariaLabel={`${g.name} 분야 더하기`} pending={pending} />
              ))}
            </div>
          )}
          {myNews.length === 0 && (
            <>
              <h4 className={`text-[13px] font-black text-sub ${restGroups.length > 0 ? "mt-4" : ""}`}>뉴스 헤드라인</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {news.map((n) => (
                  <AddButton key={n.id} id={n.id} name={n.name} ariaLabel={`${n.name} 뉴스 더하기`} pending={pending} />
                ))}
              </div>
            </>
          )}
        </form>
      )}
    </>
  );
}

/** n/한도. 차면 주황으로 */
function Count({ used, limit }: { used: number; limit: number }) {
  return (
    <span className={`font-round text-[14px] font-black ${used >= limit ? "text-mango-deep" : "text-sub"}`}>
      {used}/{limit}
      {used > limit && <span className="sr-only"> 한도를 넘었어요</span>}
    </span>
  );
}

/**
 * 내 관심사 한 줄. 누르면 아래로 펼쳐져 고칠 목록이 나온다(details, 같은 name끼리는 하나만 열린다).
 * 고친 뒤 화면을 다시 그려도 같은 줄이 열린 채로 남는다(open을 React가 건드리지 않는다).
 */
function Row({ id, title, summary, removeLabel, removable, children }: { id: string; title: string; summary: string; removeLabel: string; removable: boolean; children: React.ReactNode }) {
  return (
    <details name="my-topics" className="group/row">
      <summary className="flex min-h-[68px] cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-snow [&::-webkit-details-marker]:hidden">
        <TopicGroupIcon id={id} className="size-10 rounded-xl" iconClassName="size-[22px]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-black leading-snug">{title}</span>
          <span className="block truncate text-[13px] font-semibold leading-snug text-sub">{summary}</span>
        </span>
        <IconChevronDown className="size-5 text-faint transition-transform group-open/row:rotate-180" />
      </summary>
      <div className="pb-1.5">
        {children}
        <button
          type="submit"
          name="removeCard"
          value={id}
          disabled={!removable}
          title={removable ? undefined : "관심사가 하나는 있어야 해요"}
          className="mt-1 flex min-h-11 w-full items-center pl-[68px] text-left text-[14px] font-extrabold text-orange hover:underline disabled:text-faint disabled:no-underline"
        >
          {removeLabel}
        </button>
      </div>
    </details>
  );
}

/** 펼친 줄 안의 체크 한 줄. 줄 전체를 누르면 켜고 끈다 */
function CheckRow({ id, label, on, disabled }: { id: string; label: string; on: boolean; disabled: boolean }) {
  return (
    <button
      type="submit"
      name={on ? "remove" : "add"}
      value={id}
      aria-pressed={on}
      disabled={disabled}
      className="flex min-h-12 w-full items-center gap-3 pl-[68px] pr-4 text-left text-[15px] font-extrabold hover:bg-snow disabled:cursor-default disabled:hover:bg-transparent"
    >
      <span className={`min-w-0 flex-1 truncate ${on ? "text-ink" : "text-sub"}`}>{label}</span>
      <i aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-sky bg-sky text-white" : "border-line bg-white"}`}>
        {on && <IconCheck className="size-4 [stroke-width:3.2]" />}
      </i>
    </button>
  );
}

/** 아직 안 고른 분야 더하기 */
function AddButton({ id, name, ariaLabel, pending }: { id: string; name: string; ariaLabel: string; pending: boolean }) {
  return (
    <button
      type="submit"
      name="add"
      value={id}
      disabled={pending}
      aria-label={ariaLabel}
      className="tile inline-flex min-h-11 items-center gap-2 py-1 pl-1.5 pr-3 text-[14px] font-extrabold hover:bg-snow"
    >
      <TopicGroupIcon id={id} className="size-7 rounded-lg" iconClassName="size-4" />
      {name}
      <IconPlus className="size-3.5 text-sky [stroke-width:2.8]" />
    </button>
  );
}

/** 이름이 그 말로 시작하면 먼저, 별칭이 그 말로 시작하면 다음, 어디든 들어 있으면 그다음. 짧은 이름이 앞 */
function rank(list: TopicSuggestion[], key: string): TopicSuggestion[] {
  return list
    .map((s) => {
      const terms = s.terms.map(normalizeInterest);
      const score = terms[0]!.startsWith(key) ? 3 : terms.some((t) => t.startsWith(key)) ? 2 : terms.some((t) => t.includes(key)) ? 1 : 0;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.name.length - b.s.name.length)
    .map((x) => x.s);
}

const MAX_OPTIONS = 6;

/**
 * 관심사 찾기 칸(콤보 상자). 적는 대로 사전에서 후보를 보여 주고, 맨 끝에 적은 말 그대로 넣기를 둔다.
 * 후보는 add로, 적은 말은 text로 보낸다(서버가 사전 이름과 같으면 그 관심사로, 아니면 기타로 넣는다. 쉼표로 3개까지).
 * Enter는 고른 후보가 있으면 그 후보, 없으면 적은 말을 넣는다. 넣기 버튼이 후보보다 앞에 있어야 Enter의 기본 동작이 넣기다.
 */
function TopicSearch({ action, pending, suggestions }: { action: (formData: FormData) => void; pending: boolean; suggestions: TopicSuggestion[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();
  const key = normalizeInterest(q);
  const matches = useMemo(() => (key ? rank(suggestions, key).slice(0, MAX_OPTIONS) : []), [key, suggestions]);
  const exact = matches.some((m) => m.terms.some((t) => normalizeInterest(t) === key));
  const count = matches.length + (key && !exact ? 1 : 0);
  const shown = open && count > 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (count) setActive((i) => (e.key === "ArrowDown" ? (i + 1) % count : (i - 1 + count) % count));
    } else if (e.key === "Enter" && shown && active >= 0) {
      e.preventDefault();
      optionRefs.current[active]?.click();
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const optionClass = (i: number) =>
    `flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[15px] font-extrabold ${i === active ? "bg-snow" : "hover:bg-snow"}`;

  return (
    <form action={action} className="relative">
      <label htmlFor="topic-search" className="sr-only">
        관심사 찾기 또는 직접 적기
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-faint" />
          <input
            id="topic-search"
            name="text"
            required
            maxLength={200}
            autoComplete="off"
            role="combobox"
            aria-expanded={shown}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="관심사 찾기 또는 직접 적기"
            className="tile min-h-12 w-full pl-11 pr-4 text-[15px] font-semibold placeholder:text-faint"
          />
        </div>
        <button type="submit" disabled={pending} className="btn min-h-12 shrink-0 px-5">
          {pending ? "넣는 중" : "넣기"}
        </button>
      </div>
      {/* 누르는 동안 입력칸이 포커스를 잃어 목록이 닫히지 않게 mousedown을 막는다 */}
      <div id={listId} role="listbox" aria-label="관심사 후보" hidden={!shown} className="tile absolute inset-x-0 top-full z-20 mt-1.5 p-1.5 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
        {matches.map((m, i) => (
          <button
            key={m.id}
            ref={(el) => {
              optionRefs.current[i] = el;
            }}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            type="submit"
            name="add"
            value={m.id}
            disabled={pending}
            className={optionClass(i)}
          >
            <IconPlus className="size-4 text-sky [stroke-width:2.6]" />
            <span className="min-w-0 truncate">{m.name}</span>
            <span className="ml-auto shrink-0 text-[13px] font-bold text-faint">{m.hint}</span>
          </button>
        ))}
        {key && !exact && (
          <button
            ref={(el) => {
              optionRefs.current[matches.length] = el;
            }}
            id={`${listId}-${matches.length}`}
            role="option"
            aria-selected={active === matches.length}
            type="submit"
            disabled={pending}
            className={optionClass(matches.length)}
          >
            <IconPlus className="size-4 text-sky [stroke-width:2.6]" />
            <span className="min-w-0 truncate">‘{q.trim()}’ 넣기</span>
            <span className="ml-auto shrink-0 text-[13px] font-bold text-faint">기타</span>
          </button>
        )}
      </div>
    </form>
  );
}
