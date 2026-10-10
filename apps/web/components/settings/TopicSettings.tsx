"use client";

import { startTransition, useActionState, useEffect, useId, useMemo, useOptimistic, useRef, useState } from "react";
import { editTopics } from "@/app/actions";
import { IconCheck, IconChevronDown, IconClose } from "@/components/icons";
import { TopicGroupIcon, topicTone } from "@/components/TopicGroupIcon";
import type { TopicGroupView, TopicResult, UserTopic } from "@/lib/types";

type Section = { id: string; name: string; picked: boolean };
type Op = { drop: string[]; add: string[] };
type Send = { fields: Record<string, string>; op?: Op };
type Chip = { id: string; name: string; tone: string; remove: () => void };

/**
 * 설정 > 관심사(2026-10-11 개편). 고른 관심사만 분야 색 라벨로 보여 주고, 고르기는 분야별 드롭다운으로 한다.
 * - 라벨: 분야 전체를 고르면 분야 이름('AI') 하나만, 아니면 고른 상세 관심사들. 뉴스 분야·기타는 그 이름. ✕로 뺀다.
 * - 드롭다운(분야마다 하나 + 뉴스 + 기타): 누르면 아래에 체크 목록이 열리고, 체크해도 닫히지 않는다. 바깥을 누르거나 Esc면 닫힌다.
 *   분야는 트리 선택처럼 움직인다: 전체를 켜면 상세가 모두 켜진 것으로 보이고(라벨은 분야 하나), 그 상태에서 상세 하나를 끄면 나머지 상세만 남고,
 *   상세를 다 켜면 전체로 합친다. 서버도 같은 규칙으로 저장한다(setGroupPicks).
 * - 누르는 즉시 라벨·체크가 바뀐다(useOptimistic). 서버가 막으면(한도 등) 되돌아가고 까닭을 보여 준다.
 */
export function TopicSettings({ groups, news, custom }: { groups: TopicGroupView[]; news: Section[]; custom: UserTopic[] }) {
  const panelId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");

  const serverPicked = useMemo(
    () =>
      new Set([
        ...groups.flatMap((g) => [...(g.picked ? [g.id] : []), ...g.details.filter((d) => d.picked).map((d) => d.id)]),
        ...news.filter((n) => n.picked).map((n) => n.id),
        ...custom.map((c) => c.id),
      ]),
    [groups, news, custom],
  );
  const [picked, apply] = useOptimistic(serverPicked, (cur: Set<string>, op: Op) => {
    const next = new Set(cur);
    for (const id of op.drop) next.delete(id);
    for (const id of op.add) next.add(id);
    return next;
  });

  const [state, dispatch] = useActionState<TopicResult | null, Send>(async (prev, { fields, op }) => {
    if (op) apply(op);
    const formData = new FormData();
    for (const [k, v] of Object.entries(fields)) formData.set(k, v);
    const r = await editTopics(prev, formData);
    if ("text" in fields && r?.tone !== "warn") setText("");
    return r;
  }, null);
  const send = (fields: Record<string, string>, op?: Op) => startTransition(() => dispatch({ fields, op }));

  /** 분야 하나에서 고른 것을 통째로 정한다. 상세를 다 고르면 전체로 */
  const setGroup = (g: TopicGroupView, next: "all" | string[]) => {
    const children = g.details.map((d) => d.id);
    const desired = next === "all" || next.length === children.length ? [g.id] : next;
    const drop = [g.id, ...children].filter((id) => picked.has(id) && !desired.includes(id));
    const add = desired.filter((id) => !picked.has(id));
    if (picked.size - drop.length + add.length < 1) return;
    send({ group: g.id, pick: desired.includes(g.id) ? "all" : desired.join(",") }, { drop, add });
  };
  const clickWhole = (g: TopicGroupView) => setGroup(g, picked.has(g.id) ? [] : "all");
  const clickDetail = (g: TopicGroupView, id: string) => {
    const ids = g.details.map((d) => d.id);
    if (picked.has(g.id)) return setGroup(g, ids.filter((x) => x !== id));
    const some = ids.filter((x) => picked.has(x));
    setGroup(g, some.includes(id) ? some.filter((x) => x !== id) : [...some, id]);
  };
  /** 뉴스 분야·기타 하나 켜고 끄기 */
  const toggleOne = (id: string) => {
    if (picked.has(id)) {
      if (picked.size <= 1) return;
      send({ remove: id }, { drop: [id], add: [] });
    } else send({ add: id }, { drop: [], add: [id] });
  };

  const chips: Chip[] = [
    ...groups.flatMap((g): Chip[] =>
      picked.has(g.id)
        ? [{ id: g.id, name: g.name, tone: g.id, remove: () => setGroup(g, []) }]
        : g.details.filter((d) => picked.has(d.id)).map((d) => ({ id: d.id, name: d.name, tone: g.id, remove: () => clickDetail(g, d.id) })),
    ),
    ...news.filter((n) => picked.has(n.id)).map((n) => ({ id: n.id, name: n.name, tone: n.id, remove: () => toggleOne(n.id) })),
    ...custom.filter((c) => picked.has(c.id)).map((c) => ({ id: c.id, name: c.name, tone: "etc", remove: () => toggleOne(c.id) })),
  ];
  const only = chips.length <= 1;

  // 바깥을 누르면 닫는다(모바일 사파리는 버튼에 포커스를 주지 않아 blur만으로는 못 닫는다)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const openGroup = groups.find((g) => g.id === open);
  const newsCount = news.filter((n) => picked.has(n.id)).length;
  const customCount = custom.filter((c) => picked.has(c.id)).length;
  const trigger = (id: string, label: string, badge: string | null) => (
    <button
      key={id}
      type="button"
      aria-expanded={open === id}
      aria-controls={open === id ? panelId : undefined}
      onClick={() => setOpen((o) => (o === id ? null : id))}
      className={`tile inline-flex min-h-11 items-center gap-2 py-1 pl-1.5 pr-2.5 text-[14px] font-extrabold transition-colors ${
        open === id ? "border-sky bg-sky-tint" : "hover:bg-snow"
      }`}
    >
      <TopicGroupIcon id={id} className="size-7 rounded-lg" iconClassName="size-4" />
      {label}
      {badge && <span className="rounded-full bg-sky px-1.5 py-px text-[12px] font-black leading-[18px] text-white">{badge}</span>}
      <IconChevronDown className={`size-4 text-faint transition-transform ${open === id ? "rotate-180" : ""}`} />
    </button>
  );

  return (
    <>
      {chips.length > 0 && (
        <ul aria-label="내 관심사" className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c.id} className={`inline-flex min-h-9 items-center gap-0.5 rounded-xl py-0.5 pl-3 pr-1 text-[14px] font-extrabold ${topicTone(c.tone)}`}>
              {c.name}
              <button
                type="button"
                onClick={c.remove}
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

      <div
        ref={boxRef}
        className={`relative ${chips.length > 0 ? "mt-3" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            setOpen(null);
            boxRef.current?.querySelector<HTMLButtonElement>(`[aria-expanded="true"]`)?.focus();
          }
        }}
      >
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const some = g.details.filter((d) => picked.has(d.id)).length;
            return trigger(g.id, g.name, picked.has(g.id) ? "전체" : some ? String(some) : null);
          })}
          {trigger("news", "뉴스", newsCount ? String(newsCount) : null)}
          {trigger("etc", "기타", customCount ? String(customCount) : null)}
        </div>

        {open && (
          <div id={panelId} className="tile absolute inset-x-0 top-full z-20 mt-2 max-h-[min(60vh,460px)] overflow-y-auto overscroll-contain p-1.5 shadow-lg">
            {openGroup && (
              <>
                <CheckRow
                  label={`${openGroup.name} 전체`}
                  checked={picked.has(openGroup.id) ? true : openGroup.details.some((d) => picked.has(d.id)) ? "mixed" : false}
                  onClick={() => clickWhole(openGroup)}
                />
                <hr aria-hidden className="mx-3 my-1 border-t-2 border-line" />
                {openGroup.details.map((d) => (
                  <CheckRow key={d.id} label={d.name} checked={picked.has(openGroup.id) || picked.has(d.id)} onClick={() => clickDetail(openGroup, d.id)} />
                ))}
              </>
            )}
            {open === "news" && news.map((n) => <CheckRow key={n.id} label={n.name} checked={picked.has(n.id)} onClick={() => toggleOne(n.id)} />)}
            {open === "etc" && (
              <form
                className="flex gap-2 p-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) send({ text: text.trim() });
                }}
              >
                <label htmlFor="etc-text" className="sr-only">
                  목록에 없는 관심사
                </label>
                <input
                  id="etc-text"
                  autoFocus
                  autoComplete="off"
                  maxLength={200}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="목록에 없는 관심사(예: 드론, 게임)"
                  className="tile min-h-12 min-w-0 flex-1 px-4 text-[15px] font-semibold placeholder:text-faint"
                />
                <button type="submit" disabled={!text.trim()} className="btn min-h-12 shrink-0 px-5">
                  넣기
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** 체크 한 줄. 줄 전체를 누르면 켜고 끈다. mixed는 분야 전체 칸에서 상세 몇 개만 골랐을 때 */
function CheckRow({ label, checked, onClick }: { label: string; checked: boolean | "mixed"; onClick: () => void }) {
  const on = checked === true;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-extrabold hover:bg-snow ${on ? "text-ink" : "text-sub"}`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <i
        aria-hidden
        className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-sky bg-sky text-white" : checked === "mixed" ? "border-sky bg-white text-sky" : "border-line bg-white"}`}
      >
        {on && <IconCheck className="size-3.5 [stroke-width:3.4]" />}
        {checked === "mixed" && <span className="h-0.5 w-2.5 rounded-full bg-current" />}
      </i>
    </button>
  );
}
