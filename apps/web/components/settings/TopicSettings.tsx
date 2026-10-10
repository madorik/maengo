"use client";

import { normalizeInterest } from "@maengo/core/topics";
import { useActionState, useId, useMemo, useRef, useState } from "react";
import { editTopics } from "@/app/actions";
import { IconCheck, IconClose, IconPlus, IconSearch } from "@/components/icons";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import type { TopicGroupView, TopicResult, TopicSuggestion, UserTopic } from "@/lib/types";

type Section = { id: string; name: string; picked: boolean };
/** 결과 안내 + 잘 들어간 횟수(찾기 칸을 비우는 데 쓴다. 막혔을 때는 적던 글자를 남긴다) */
type State = (TopicResult & { okSeq: number }) | null;

/**
 * 설정 > 관심사(2026-10-11 개편). 고른 것만 펼쳐 보여서 한 화면에 깔리는 버튼 수를 줄인다.
 * - 맨 위 찾기 칸: 사전의 이름·별칭으로 자동 완성하고, 없는 말은 그대로 기타로 넣는다(예전 기타 칸을 합쳤다).
 * - 내 관심사: 고른 분야마다 카드 하나. 카드 안 칩을 눌러 켜고 끈다(분야 전체와 상세 관심사는 따로 켠다). ×는 카드를 통째로 뺀다.
 *   뉴스 헤드라인은 카드 하나에 6개 분야 칩, 기타는 적은 말 칩.
 * - 더하기: 아직 안 고른 분야만 한 줄씩.
 */
export function TopicSettings({
  groups,
  news,
  custom,
  limit,
  customLimit,
  suggestions,
}: {
  groups: TopicGroupView[];
  news: Section[];
  custom: UserTopic[];
  limit: number;
  customLimit: number;
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
      <TopicSearch key={state?.okSeq ?? 0} action={action} pending={pending} suggestions={suggestions.filter((s) => !picked.has(s.id))} />
      <p aria-live="polite" className="mt-2 text-[14px] font-bold text-mango-deep empty:hidden">
        {state?.message}
      </p>

      <div className="mt-5 flex items-baseline justify-between">
        <h3 className="text-[15px] font-black">내 관심사</h3>
        <Count used={picked.size} limit={limit} />
      </div>
      <form action={action} className="mt-3 flex flex-col gap-3">
        {myGroups.map((g) => {
          const count = (g.picked ? 1 : 0) + g.details.filter((d) => d.picked).length;
          return (
            <Card key={g.id} id={g.id} title={g.name} pending={pending} lastCard={count >= total}>
              <Toggle id={g.id} label="전체" ariaLabel={`${g.name} 분야 전체`} picked={g.picked} pending={pending} only={only} />
              {g.details.map((d) => (
                <Toggle key={d.id} id={d.id} label={d.name} picked={d.picked} pending={pending} only={only} />
              ))}
            </Card>
          );
        })}
        {myNews.length > 0 && (
          <Card id="news" title="뉴스 헤드라인" pending={pending} lastCard={myNews.length >= total}>
            {news.map((n) => (
              <Toggle key={n.id} id={n.id} label={n.name} ariaLabel={`${n.name} 뉴스`} picked={n.picked} pending={pending} only={only} />
            ))}
          </Card>
        )}
        {custom.length > 0 && (
          <Card id="etc" title="기타" pending={pending} lastCard={custom.length >= total} aside={<Count used={custom.length} limit={customLimit} />}>
            {custom.map((t) => (
              <span key={t.id} className="inline-flex min-h-9 items-center gap-0.5 rounded-xl border-2 border-sky bg-sky-tint py-0.5 pl-3 pr-1 text-[14px] font-extrabold text-sky-dark">
                {t.name}
                <button
                  type="submit"
                  name="remove"
                  value={t.id}
                  disabled={pending || only}
                  aria-label={`${t.name} 빼기`}
                  className="flex size-7 items-center justify-center rounded-lg hover:bg-white/70 disabled:opacity-40"
                >
                  <IconClose className="size-3.5 [stroke-width:2.8]" />
                </button>
              </span>
            ))}
          </Card>
        )}
      </form>

      {(restGroups.length > 0 || myNews.length === 0) && (
        <form action={action} className="mt-6">
          <h3 className="text-[15px] font-black">더하기</h3>
          {restGroups.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {restGroups.map((g) => (
                <li key={g.id}>
                  <AddButton id={g.id} name={g.name} ariaLabel={`${g.name} 분야 더하기`} pending={pending} />
                </li>
              ))}
            </ul>
          )}
          {myNews.length === 0 && (
            <>
              <h4 className="mt-4 text-[14px] font-black text-sub">뉴스 헤드라인</h4>
              <ul className="mt-2 flex flex-wrap gap-2">
                {news.map((n) => (
                  <li key={n.id}>
                    <AddButton id={n.id} name={n.name} ariaLabel={`${n.name} 뉴스 더하기`} pending={pending} />
                  </li>
                ))}
              </ul>
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

/** 내 관심사 카드 하나. lastCard면 이 카드가 관심사 전부라 ×를 막는다 */
function Card({
  id,
  title,
  pending,
  lastCard,
  aside,
  children,
}: {
  id: string;
  title: string;
  pending: boolean;
  lastCard: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`card-${id}`} className="tile p-3">
      <div className="flex items-center gap-2.5">
        <TopicGroupIcon id={id} className="size-8 rounded-xl" iconClassName="size-[18px]" />
        <h4 id={`card-${id}`} className="min-w-0 flex-1 truncate text-[16px] font-black">
          {title}
        </h4>
        {aside}
        <button
          type="submit"
          name="removeCard"
          value={id}
          disabled={pending || lastCard}
          aria-label={`${title} 빼기`}
          title={lastCard ? "관심사가 하나는 있어야 해요" : undefined}
          className="flex size-9 items-center justify-center rounded-lg text-faint hover:bg-snow hover:text-ink disabled:opacity-40"
        >
          <IconClose className="size-4 [stroke-width:2.6]" />
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

/** 켜고 끄는 칩. 켜져 있으면 하늘색 + 체크, 꺼져 있으면 + */
function Toggle({ id, label, ariaLabel, picked, pending, only }: { id: string; label: string; ariaLabel?: string; picked: boolean; pending: boolean; only: boolean }) {
  return (
    <button
      type="submit"
      name={picked ? "remove" : "add"}
      value={id}
      aria-pressed={picked}
      aria-label={ariaLabel}
      disabled={pending || (picked && only)}
      className={`inline-flex min-h-9 items-center gap-1 rounded-xl border-2 px-2.5 text-[14px] font-extrabold transition-colors disabled:cursor-default ${
        picked ? "border-sky bg-sky-tint text-sky-dark" : "border-line bg-white text-sub hover:bg-snow hover:text-ink"
      }`}
    >
      {picked ? <IconCheck className="size-3.5 [stroke-width:3.2]" /> : <IconPlus className="size-3.5 text-sky [stroke-width:2.8]" />}
      {label}
    </button>
  );
}

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
