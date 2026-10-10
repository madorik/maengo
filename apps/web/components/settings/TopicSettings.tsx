"use client";

import { normalizeInterest } from "@maengo/core/topics";
import { startTransition, useActionState, useEffect, useId, useMemo, useOptimistic, useRef, useState } from "react";
import { editTopics } from "@/app/actions";
import { IconCheck, IconChevronDown, IconClose, IconPlus } from "@/components/icons";
import { TopicGroupIcon, topicTone } from "@/components/TopicGroupIcon";
import type { TopicGroupView, TopicResult, TopicSuggestion, UserTopic } from "@/lib/types";

type Section = { id: string; name: string; picked: boolean };
type Option = { id: string; label: string; chip: string };
type Op = { kind: "add" | "remove"; id: string };

/**
 * 설정 > 관심사(2026-10-11 개편). 고른 관심사만 분야 색 라벨로 보여 주고, 고르기는 드롭다운 하나로 한다.
 * - 라벨: 분야 전체는 분야 이름('AI'), 상세 관심사·뉴스 분야·기타는 그 이름. ✕로 뺀다.
 * - 드롭다운: 분야별 묶음 목록(분야 전체 → 상세 관심사, 마지막에 뉴스 헤드라인). 체크해도 닫히지 않아 여러 개를 연달아 고른다.
 *   적으면 이름·별칭으로 거르고, 목록에 없는 말은 '넣기'로 기타에 넣는다(서버가 사전 이름과 같으면 그 관심사로 넣는다).
 * - 누르는 즉시 라벨·체크가 바뀐다(useOptimistic). 서버가 막으면(한도 등) 되돌아가고 까닭을 보여 준다.
 */
export function TopicSettings({
  groups,
  news,
  custom,
  suggestions,
}: {
  groups: TopicGroupView[];
  news: Section[];
  custom: UserTopic[];
  suggestions: TopicSuggestion[];
}) {
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const sections = useMemo(
    () => [
      ...groups.map((g) => ({
        id: g.id,
        title: g.name,
        options: [{ id: g.id, label: `${g.name} 전체`, chip: g.name }, ...g.details.map((d) => ({ id: d.id, label: d.name, chip: d.name }))] as Option[],
      })),
      { id: "news", title: "뉴스 헤드라인", options: news.map((n) => ({ id: n.id, label: n.name, chip: n.name })) as Option[] },
    ],
    [groups, news],
  );
  // 라벨 색: 상세 관심사는 분야 색, 뉴스 분야는 그 분야 색, 기타는 회색
  const toneOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) for (const id of [g.id, ...g.details.map((d) => d.id)]) m.set(id, g.id);
    for (const n of news) m.set(n.id, n.id);
    return m;
  }, [groups, news]);
  const terms = useMemo(() => new Map(suggestions.map((s) => [s.id, s.terms.map(normalizeInterest)])), [suggestions]);

  const serverPicked = useMemo(
    () =>
      new Set([
        ...groups.flatMap((g) => [...(g.picked ? [g.id] : []), ...g.details.filter((d) => d.picked).map((d) => d.id)]),
        ...news.filter((n) => n.picked).map((n) => n.id),
        ...custom.map((c) => c.id),
      ]),
    [groups, news, custom],
  );
  const [picked, applyOp] = useOptimistic(serverPicked, (cur: Set<string>, op: Op) => {
    const next = new Set(cur);
    if (op.kind === "add") next.add(op.id);
    else next.delete(op.id);
    return next;
  });

  const [state, dispatch] = useActionState<TopicResult | null, FormData>(async (prev, formData) => {
    const add = formData.get("add");
    const remove = formData.get("remove");
    if (typeof add === "string") applyOp({ kind: "add", id: add });
    if (typeof remove === "string") applyOp({ kind: "remove", id: remove });
    const r = await editTopics(prev, formData);
    if (formData.has("text") && r?.tone !== "warn") setQuery("");
    return r;
  }, null);
  const send = (key: "add" | "remove" | "text", value: string) => {
    const formData = new FormData();
    formData.set(key, value);
    startTransition(() => dispatch(formData));
  };

  const chips = [
    ...sections.flatMap((s) => s.options.filter((o) => picked.has(o.id)).map((o) => ({ id: o.id, name: o.chip, tone: toneOf.get(o.id) ?? "etc" }))),
    ...custom.filter((c) => picked.has(c.id)).map((c) => ({ id: c.id, name: c.name, tone: "etc" })),
  ];
  const only = chips.length <= 1;

  const key = normalizeInterest(query);
  const visible = key
    ? sections
        .map((s) => ({ ...s, options: s.options.filter((o) => [normalizeInterest(o.label), ...(terms.get(o.id) ?? [])].some((t) => t.includes(key))) }))
        .filter((s) => s.options.length > 0)
    : sections;
  const flat = visible.flatMap((s) => s.options);
  const exact = !!key && [...terms.values()].some((ts) => ts.includes(key));
  const textOption = !!key && !exact;
  const count = flat.length + (textOption ? 1 : 0);
  const shown = open && count > 0;

  const toggle = (id: string) => {
    if (picked.has(id)) {
      if (only) return;
      send("remove", id);
    } else send("add", id);
    // 걸러서 골랐으면 전체 목록으로 돌아간다
    if (key) {
      setQuery("");
      setActive(-1);
    }
  };
  const addText = () => {
    if (query.trim()) send("text", query.trim());
  };

  // 바깥을 누르면 닫는다(모바일 사파리는 버튼에 포커스를 주지 않아 blur만으로는 못 닫는다)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (count) setActive((i) => (e.key === "ArrowDown" ? (i + 1) % count : (i <= 0 ? count : i) - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && active < flat.length) toggle(flat[active]!.id);
      else if (active === flat.length && textOption) addText();
      else if (key) {
        // 적은 말과 이름·별칭이 똑같은 관심사가 보이면 그것을, 없으면 기타로
        const hit = flat.find((o) => (terms.get(o.id) ?? []).includes(key));
        if (hit) toggle(hit.id);
        else addText();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <>
      {chips.length > 0 && (
        <ul aria-label="내 관심사" className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c.id} className={`inline-flex min-h-9 items-center gap-0.5 rounded-xl py-0.5 pl-3 pr-1 text-[14px] font-extrabold ${topicTone(c.tone)}`}>
              {c.name}
              <button
                type="button"
                onClick={() => toggle(c.id)}
                disabled={only}
                aria-label={`${c.name} 빼기`}
                title={only ? "관심사가 하나는 있어야 해요" : undefined}
                className="flex size-7 items-center justify-center rounded-lg opacity-60 hover:bg-white/70 hover:opacity-100 disabled:opacity-25"
              >
                <IconClose className="size-3.5 [stroke-width:2.8]" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="mt-2 text-[14px] font-bold text-mango-deep empty:hidden">
        {state?.message}
      </p>

      <div ref={boxRef} className={`relative ${chips.length > 0 ? "mt-3" : ""}`}>
        <label htmlFor="topic-pick" className="sr-only">
          관심사 고르기 또는 직접 적기
        </label>
        <input
          ref={inputRef}
          id="topic-pick"
          autoComplete="off"
          maxLength={200}
          role="combobox"
          aria-expanded={shown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="관심사 고르기 또는 직접 적기"
          className={`tile min-h-12 w-full pl-4 pr-12 text-[15px] font-semibold placeholder:text-faint ${shown ? "border-sky" : ""}`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={shown ? "목록 닫기" : "목록 열기"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-lg text-faint hover:bg-snow hover:text-ink"
        >
          <IconChevronDown className={`size-5 transition-transform ${shown ? "rotate-180" : ""}`} />
        </button>

        {/* 누르는 동안 입력칸이 포커스를 잃어 목록이 닫히지 않게 mousedown을 막는다 */}
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label="관심사 목록"
          hidden={!shown}
          onMouseDown={(e) => e.preventDefault()}
          className="tile absolute inset-x-0 top-full z-20 mt-1.5 max-h-[min(60vh,440px)] overflow-y-auto overscroll-contain p-1.5 shadow-lg"
        >
          {visible.map((s) => (
            <div key={s.id} role="group" aria-labelledby={`${listId}-g-${s.id}`}>
              <div id={`${listId}-g-${s.id}`} className="sticky top-0 z-10 flex items-center gap-2 bg-white px-2 pb-1 pt-2.5 text-[13px] font-black text-sub">
                <TopicGroupIcon id={s.id} className="size-5 rounded-md" iconClassName="size-3.5" />
                {s.title}
              </div>
              {s.options.map((o) => {
                const i = flat.indexOf(o);
                const on = picked.has(o.id);
                return (
                  <div
                    key={o.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(o.id)}
                    onPointerEnter={() => setActive(i)}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] font-extrabold ${i === active ? "bg-snow" : ""} ${on ? "text-ink" : "text-sub"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    <i aria-hidden className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-sky bg-sky text-white" : "border-line bg-white"}`}>
                      {on && <IconCheck className="size-3.5 [stroke-width:3.4]" />}
                    </i>
                  </div>
                );
              })}
            </div>
          ))}
          {textOption && (
            <div
              id={`${listId}-${flat.length}`}
              role="option"
              aria-selected={false}
              onClick={addText}
              onPointerEnter={() => setActive(flat.length)}
              className={`mt-1 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-[15px] font-extrabold ${active === flat.length ? "bg-snow" : ""}`}
            >
              <IconPlus className="size-4 text-sky [stroke-width:2.6]" />
              <span className="min-w-0 truncate">‘{query.trim()}’ 넣기</span>
              <span className="ml-auto shrink-0 text-[13px] font-bold text-faint">기타</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
