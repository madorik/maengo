"use client";

import { startTransition, useActionState, useEffect, useId, useMemo, useOptimistic, useRef, useState } from "react";
import { editTopics } from "@/app/actions";
import { track } from "@/lib/analytics";
import { IconCheck, IconChevronDown, IconClose } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { topicTone } from "@/components/TopicGroupIcon";
import type { TopicGroupView, TopicResult, UserTopic } from "@/lib/types";

type Section = { id: string; name: string; picked: boolean };
type Op = { drop: string[]; add: string[] };
type Send = { fields: Record<string, string>; op?: Op };
/** remove는 실제로 뺐으면 true, undo는 되돌리기 알림에서 다시 넣기 */
type Chip = { id: string; name: string; tone: string; remove: () => boolean; undo: () => void };

/**
 * 내 관심 키워드 > 관심 분야(2026-10-11 개편, 2026-11-08 설정에서 따로 뺌). 고른 관심사만 분야 색 라벨로 보여 주고, 고르기는 분야별 드롭다운으로 한다.
 * 직접 적는 말(예전 '기타')은 아래 '내 키워드' 묶음(KeywordSlots)에서 고친다. custom은 '하나는 남기기'를 셀 때만 쓴다.
 * - 라벨: 분야 전체를 고르면 분야 이름('AI') 하나만, 아니면 고른 상세 관심사들. 뉴스 분야는 그 이름. ✕로 뺀다.
 * - 드롭다운(분야마다 하나 + 뉴스): 누르면 아래에 체크 목록이 열리고, 체크해도 닫히지 않는다. 바깥을 누르거나 Esc면 닫힌다.
 *   분야는 트리 선택처럼 움직인다: 전체를 켜면 상세가 모두 켜진 것으로 보이고(라벨은 분야 하나), 그 상태에서 상세 하나를 끄면 나머지 상세만 남고,
 *   상세를 다 켜면 전체로 합친다. 서버도 같은 규칙으로 저장한다(setGroupPicks).
 * - 누르는 즉시 라벨·체크가 바뀐다(useOptimistic). 서버가 막으면(한도 등) 되돌아가고 까닭을 보여 준다.
 * - 라벨 ✕로 빼면 되돌리기 알림이 뜬다. 누르면 그때 고른 상태에 그 관심사를 다시 넣는다(한도에 걸리면 위와 같이 까닭을 보여 준다).
 */
export function TopicSettings({ groups, news, custom }: { groups: TopicGroupView[]; news: Section[]; custom: UserTopic[] }) {
  const panelId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  /** 고르기 상자 자리: 누른 분야 바로 아래(2026-11-12 사용자 '선택박스가 맨 밑에 생겨, 관심 분야 밑에'). 오른쪽으로 넘치면 왼쪽으로 당긴다 */
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const place = (chip: HTMLElement | null | undefined) => {
    const box = boxRef.current;
    if (!box || !chip) return null;
    const b = box.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    const width = Math.min(340, b.width);
    return { left: Math.max(0, Math.min(c.left - b.left, b.width - width)), top: c.bottom - b.top + 8, width };
  };

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
    return editTopics(prev, formData);
  }, null);
  const send = (fields: Record<string, string>, op?: Op) => {
    // 분석: 무엇을 했는지만
    if ("group" in fields) track("topic_edit", { action: "group", group: fields.group, picks: fields.pick ? fields.pick.split(",").filter(Boolean).length : 0 });
    else if ("add" in fields) track("topic_edit", { action: "add", topic: fields.add });
    else if ("remove" in fields) track("topic_edit", { action: "remove", topic: fields.remove });
    startTransition(() => dispatch({ fields, op }));
  };

  /** 분야 하나에서 고른 것을 통째로 정한다. 상세를 다 고르면 전체로. 보냈으면 true */
  const setGroup = (g: TopicGroupView, next: "all" | string[]) => {
    const children = g.details.map((d) => d.id);
    const desired = next === "all" || next.length === children.length ? [g.id] : next;
    const drop = [g.id, ...children].filter((id) => picked.has(id) && !desired.includes(id));
    const add = desired.filter((id) => !picked.has(id));
    if (picked.size - drop.length + add.length < 1) return false;
    send({ group: g.id, pick: desired.includes(g.id) ? "all" : desired.join(",") }, { drop, add });
    return true;
  };
  const clickWhole = (g: TopicGroupView) => setGroup(g, picked.has(g.id) ? [] : "all");
  const clickDetail = (g: TopicGroupView, id: string) => {
    const ids = g.details.map((d) => d.id);
    if (picked.has(g.id)) return setGroup(g, ids.filter((x) => x !== id));
    const some = ids.filter((x) => picked.has(x));
    return setGroup(g, some.includes(id) ? some.filter((x) => x !== id) : [...some, id]);
  };
  /** 뉴스 분야 하나 켜고 끄기. 보냈으면 true */
  const toggleOne = (id: string) => {
    if (picked.has(id)) {
      if (picked.size <= 1) return false;
      send({ remove: id }, { drop: [id], add: [] });
    } else send({ add: id }, { drop: [], add: [id] });
    return true;
  };

  // 되돌리기는 몇 초 뒤에 눌린다: 그때 고른 상태로 판단하게 마지막 값을 들고 있는다(그사이 다른 것을 바꿨어도 그 관심사만 다시 넣는다)
  const latest = useRef({ picked, setGroup, send });
  useEffect(() => {
    latest.current = { picked, setGroup, send };
  });
  const toast = useToast();

  const chips: Chip[] = [
    ...groups.flatMap((g): Chip[] =>
      picked.has(g.id)
        ? [
            {
              id: g.id,
              name: g.name,
              tone: g.id,
              remove: () => setGroup(g, []),
              undo: () => {
                const l = latest.current;
                if (!l.picked.has(g.id)) l.setGroup(g, "all");
              },
            },
          ]
        : g.details
            .filter((d) => picked.has(d.id))
            .map((d) => ({
              id: d.id,
              name: d.name,
              tone: g.id,
              remove: () => clickDetail(g, d.id),
              // 그때 그 분야에서 고른 상세에 더한다(분야 전체를 골랐거나 이미 있으면 그대로)
              undo: () => {
                const l = latest.current;
                if (l.picked.has(g.id) || l.picked.has(d.id)) return;
                l.setGroup(g, [...g.details.map((x) => x.id).filter((x) => l.picked.has(x)), d.id]);
              },
            })),
    ),
    ...news
      .filter((n) => picked.has(n.id))
      .map((n) => ({
        id: n.id,
        name: n.name,
        tone: n.id,
        remove: () => toggleOne(n.id),
        undo: () => {
          const l = latest.current;
          if (!l.picked.has(n.id)) l.send({ add: n.id }, { drop: [], add: [n.id] });
        },
      })),
  ];
  // 내 키워드까지 합쳐 하나는 남겨야 한다(서버도 막는다)
  const only = chips.length + custom.filter((c) => picked.has(c.id)).length <= 1;

  // 바깥을 누르면 닫는다(모바일 사파리는 버튼에 포커스를 주지 않아 blur만으로는 못 닫는다)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(null);
    };
    // 화면 크기가 바뀌면 상자 자리를 다시 잡는다(분야 줄바꿈이 바뀐다)
    const onResize = () => setPos(place(chipRefs.current[open]));
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const openGroup = groups.find((g) => g.id === open);
  const newsCount = news.filter((n) => picked.has(n.id)).length;
  const trigger = (id: string, label: string, badge: string | null) => (
    <button
      key={id}
      ref={(el) => {
        chipRefs.current[id] = el;
      }}
      type="button"
      aria-expanded={open === id}
      aria-controls={open === id ? panelId : undefined}
      onClick={(e) => {
        const next = open === id ? null : id;
        setOpen(next);
        setPos(next ? place(e.currentTarget) : null);
      }}
      className={`tile inline-flex min-h-11 items-center gap-1.5 py-1 pl-3.5 pr-2.5 text-[14px] font-extrabold transition-colors ${
        open === id ? "border-sky bg-sky-tint" : "hover:bg-snow"
      }`}
    >
      {label}
      {badge && <span className="rounded-full bg-sky px-1.5 py-px text-[12px] font-black leading-[18px] text-white">{badge}</span>}
      <IconChevronDown className={`size-4 text-faint transition-transform ${open === id ? "rotate-180" : ""}`} />
    </button>
  );

  return (
    <>
      {chips.length > 0 && (
        <ul aria-label="고른 관심 분야" className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <li key={c.id} className={`inline-flex min-h-9 items-center gap-0.5 rounded-xl py-0.5 pl-3 pr-1 text-[14px] font-extrabold ${topicTone(c.tone)}`}>
              {c.name}
              {/* 누르는 곳은 44px(위아래는 음수 여백으로 라벨 높이를 그대로 둔다), 보이는 ✕는 28px. 누르면 바로 저장된다 */}
              <button
                type="button"
                onClick={() => {
                  if (c.remove()) toast.showUndo({ label: "뺐어요", onUndo: c.undo });
                }}
                disabled={only}
                aria-label={`${c.name} 빼기`}
                title={only ? "관심사가 하나는 있어야 해요" : undefined}
                className="group/x -my-1.5 -mr-1 flex size-11 shrink-0 items-center justify-center rounded-xl"
              >
                <span className={`flex size-7 items-center justify-center rounded-lg ${only ? "opacity-25" : "opacity-60 group-hover/x:bg-white/70 group-hover/x:opacity-100"}`}>
                  <IconClose className="size-3.5 [stroke-width:2.8]" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* 한도·막힘 같은 오류만 온다(잘 바뀐 건 라벨로 보인다) */}
      <p aria-live="polite" className="mt-2 text-[14px] font-bold text-cherry empty:hidden">
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
        </div>

        {open && (
          <div
            id={panelId}
            style={pos ? { left: pos.left, top: pos.top, width: pos.width } : undefined}
            className={`tile absolute z-20 max-h-[min(60vh,460px)] overflow-y-auto overscroll-contain p-1.5 shadow-lg ${pos ? "" : "inset-x-0 top-full mt-2"}`}
          >
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
        className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-sky bg-sky text-white" : checked === "mixed" ? "border-sky bg-paper text-sky" : "border-line bg-paper"}`}
      >
        {on && <IconCheck className="size-3.5 [stroke-width:3.4]" />}
        {checked === "mixed" && <span className="h-0.5 w-2.5 rounded-full bg-current" />}
      </i>
    </button>
  );
}
