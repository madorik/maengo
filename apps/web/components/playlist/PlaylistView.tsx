"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { playlistClear, playlistRemove, playlistReorder, playlistRestore } from "@/app/actions";
import { IconCheck, IconClose, IconDoc, IconGrip, IconPlay, IconPlus } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { ReadBadge } from "@/components/library/ReadBadge";
import { Bubble } from "@/components/ui/Bubble";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { SORT_INSTRUCTIONS, sortAnnouncements } from "@/components/ui/sortable-a11y";
import { useToast } from "@/components/ui/Toast";
import type { LibraryEntry } from "@/lib/types";

/** 화면에 먼저 보이는 고침: 빼기·비우기(drop), 되돌리기(put: 뺄 때 보이던 목록 그대로) */
type Edit = { drop: number[] } | { put: LibraryEntry[] };
const applyEdit = (cur: LibraryEntry[], e: Edit) => ("put" in e ? e.put : cur.filter((x) => !e.drop.includes(x.clusterId)));

/**
 * 플레이리스트 화면: 담은 순서대로 전체 듣기, 손잡이를 끌어 순서 바꾸기(터치·마우스·키보드), +로 플레이어에 추가, ×로 빼기, 비우기.
 * 끌어 놓으면 화면 순서를 먼저 바꾸고 서버에 저장한다. 빼기·비우기는 묻지 않고 바로 하고(화면에 먼저 보인다), 되돌리기 알림으로
 * 뺄 때 보이던 순서 그대로 돌려놓는다(2026-10-18, 비우기의 한 번 더 묻기를 되돌리기로 바꿈)
 */
export function PlaylistView({ entries, locked }: { entries: LibraryEntry[]; locked: boolean }) {
  const p = usePlayer();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [shown, edit] = useOptimistic(entries, applyEdit);
  // 서버가 준 목록이 바뀌면(빼기·비우기 뒤) 그 순서로 다시 맞춘다
  const serverKey = shown.map((e) => e.clusterId).join(",");
  const [order, setOrder] = useState({ key: serverKey, ids: shown.map((e) => e.clusterId) });
  const ids = order.key === serverKey ? order.ids : shown.map((e) => e.clusterId);
  const byId = new Map(shown.map((e) => [e.clusterId, e]));
  const titleOf = (id: unknown) => byId.get(Number(id))?.title ?? "소식";

  // 손잡이로만 끈다(카드 나머지는 그대로 스크롤). 살짝 움직여야 시작해 탭과 헷갈리지 않는다
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const announcements = sortAnnouncements(titleOf, (id) => ids.indexOf(Number(id)) + 1);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    setOrder({ key: serverKey, ids: next });
    start(() => playlistReorder(next));
  };

  // 되돌리기는 알림이 떠 있는 동안 한 번(새 빼기가 오면 그것만). 서버는 한 번에 하나씩 처리해서 빼기가 끝난 뒤에 되돌린다
  const undoable = (label: string, before: LibraryEntry[], back: number[]) =>
    toast.showUndo({
      label,
      onUndo: () =>
        start(async () => {
          edit({ put: before });
          await playlistRestore(back, before.map((e) => e.clusterId));
        }),
    });
  /** 지금 보이는 순서 그대로 */
  const snapshot = () => ids.flatMap((id) => byId.get(id) ?? []);
  const remove = (id: number) => {
    const before = snapshot();
    start(async () => {
      edit({ drop: [id] });
      await playlistRemove(id);
    });
    undoable("뺐어요", before, [id]);
  };
  const clear = () => {
    const before = snapshot();
    const all = before.map((e) => e.clusterId);
    start(async () => {
      edit({ drop: all });
      await playlistClear();
    });
    undoable("비웠어요", before, all);
  };

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 lg:py-10">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1">
        <h1 className="text-[28px] font-black tracking-[-0.03em]">
          플레이리스트 <span className="font-round text-[20px] text-faint">{locked ? "" : shown.length}</span>
        </h1>
        {shown.length > 0 && (
          <span className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={clear} disabled={busy} className="btn btn-ghost min-h-11 px-4 text-[14px]">
              비우기
            </button>
            <button type="button" onClick={() => p.playPlaylist(ids)} className="btn btn-sky inline-flex min-h-11 items-center gap-1.5 px-4 text-[14px]">
              <IconPlay className="size-4" />
              전체 듣기
            </button>
          </span>
        )}
      </div>

      {locked ? (
        <div className="mt-10 flex items-end gap-3">
          <Mascot mood="listen" className="size-24 shrink-0" />
          <Bubble className="mb-6 flex-1">
            <p className="text-[16px] font-bold leading-relaxed">플레이리스트는 Premium에서 쓸 수 있어요.</p>
            <Link href="/premium" className="mt-2 inline-flex items-center gap-1 text-[15px] font-extrabold text-sky">
              Premium 알아보기
              <PremiumBadge />
            </Link>
          </Bubble>
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-10 flex items-end gap-3">
          <Mascot className="size-24 shrink-0" />
          <Bubble className="mb-6 flex-1">
            <p className="text-[16px] font-bold leading-relaxed">보관함 &lsquo;골라 듣기&rsquo;에서 소식을 골라 담아 보세요.</p>
            <Link href="/library" className="mt-2 inline-block text-[15px] font-extrabold text-sky">
              보관함으로 가기
            </Link>
          </Bubble>
        </div>
      ) : (
        <DndContext id="playlist" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements, screenReaderInstructions: SORT_INSTRUCTIONS }}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="mt-6 flex flex-col gap-3">
              {ids.map((id) => {
                const e = byId.get(id);
                return e ? (
                  <Row
                    key={id}
                    entry={e}
                    busy={busy}
                    inPlayer={p.inPlayer(id)}
                    onAdd={() => p.addToPlayer([{ clusterId: id, title: e.title }])}
                    onRemove={() => remove(id)}
                  />
                ) : null;
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function Row({ entry: e, busy, inPlayer, onAdd, onRemove }: { entry: LibraryEntry; busy: boolean; inPlayer: boolean; onAdd: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: e.clusterId });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`tile relative flex items-center gap-2 py-3 pl-1 pr-2 ${isDragging ? "z-20 border-sky shadow-[0_8px_24px_rgba(0,0,0,0.12)]" : ""}`}
    >
      {/* 끌어서 옮기는 손잡이. 터치로 끌 때 화면이 스크롤되지 않게 touch-none */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`${e.title} 순서 옮기기`}
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-faint hover:bg-snow active:cursor-grabbing"
      >
        <IconGrip className="size-5" />
      </button>
      <div className="min-w-0 flex-1 pl-1">
        <div className="flex items-center gap-2 text-[13px] font-extrabold">
          <CategoryChip category={e.category} />
          <span className="inline-flex min-w-0 items-center gap-1 truncate text-sub">
            <IconDoc className="size-3.5 shrink-0" />
            {e.sourceLabel}
          </span>
          <span className="ml-auto shrink-0">
            <ReadBadge clusterId={e.clusterId} read={e.read || e.listened} />
          </span>
        </div>
        <h2 className="mt-1.5 text-[16px] font-black leading-snug tracking-[-0.02em]">
          <Link href={`/article/${e.clusterId}`} className="no-underline">
            {e.title}
          </Link>
        </h2>
      </div>
      {/* 플레이어에 추가(이미 있으면 ✓) */}
      <button
        type="button"
        aria-label={inPlayer ? `${e.title}, 플레이어에 있어요` : `${e.title} 플레이어에 추가`}
        title={inPlayer ? "플레이어에 있어요" : "플레이어에 추가"}
        onClick={onAdd}
        disabled={inPlayer}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sky enabled:hover:bg-sky-tint disabled:text-leaf"
      >
        {inPlayer ? <IconCheck className="size-5 [stroke-width:2.6]" /> : <IconPlus className="size-5 [stroke-width:2.4]" />}
      </button>
      <button
        type="button"
        aria-label={`${e.title} 빼기`}
        onClick={onRemove}
        disabled={busy}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-faint hover:bg-snow"
      >
        <IconClose className="size-5" />
      </button>
    </li>
  );
}
