"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { IconCheck, IconClose, IconGrip } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { SORT_INSTRUCTIONS, sortAnnouncements } from "@/components/ui/sortable-a11y";
import { useToast } from "@/components/ui/Toast";
import { formatClock } from "@/lib/player/machine";

export { Switch } from "@/components/ui/Switch";

type Row = { clusterId: number; title: string; rank: number };

/**
 * 재생 목록. 누르면 그 소식부터(지금 듣는 소식은 그대로). ×로 뺀다(PlayerProvider.removeFromPlayer: 듣던 자리에서 이어 간다).
 * 빼면 되돌리기 알림이 뜨고, 누르면 뺀 자리로 돌아온다(그사이 음성을 만들기 시작했으면 되돌리지 못했다고 알린다. 준비 중인 소식은 알림 없음).
 * 오늘 소식은 그날 동안 빼 두고 맨 아래 '다시 넣기'로도 되돌린다. 플레이리스트는 손잡이를 끌어 순서도 바꾼다(저장된 플레이리스트는 그대로).
 * 듣는 중에는 음성 조각이 다 있을 때만 바꿀 수 있다(새 목록으로 이어 붙이기만 하면 된다).
 * 플레이리스트 화면에서 추가한 소식은 음성을 만드는 동안 끝에 '준비 중'으로 보인다
 */
export function Queue({ onPick }: { onPick?: () => void }) {
  const p = usePlayer();
  const { data } = useToday();
  const toast = useToast();
  // 플레이리스트면 고른 소식(챕터 표), 아니면 오늘 피드에서 뺀 소식을 뺀 것
  const rows: Row[] = p.playlist
    ? p.chapters.map((ch) => ({ clusterId: ch.clusterId, title: ch.title, rank: ch.rank }))
    : data.items.filter((i) => !p.removedToday.has(i.clusterId));
  const removedCount = p.playlist ? 0 : data.items.filter((i) => p.removedToday.has(i.clusterId)).length;
  const sortable = !!p.playlist && p.canEdit;

  // 끌어 놓은 순서를 새 챕터 표가 올 때까지 먼저 보여 준다(챕터 표가 바뀌면 그 순서를 따른다)
  const key = rows.map((r) => r.clusterId).join(",");
  const [local, setLocal] = useState<{ key: string; ids: number[] } | null>(null);
  const byId = new Map(rows.map((r) => [r.clusterId, r]));
  const ids = local?.key === key ? local.ids : rows.map((r) => r.clusterId);
  const titleOf = (id: unknown) => byId.get(Number(id))?.title ?? "소식";

  // 손잡이로만 끈다. 살짝 움직여야 시작해 탭과 헷갈리지 않는다
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    setLocal({ key, ids: next });
    p.reorderPlaylist(next);
  };
  const remove = (id: number) => {
    const undo = p.removeFromPlayer(id);
    if (!undo) return;
    toast.showUndo({
      label: "뺐어요",
      onUndo: () => {
        if (!undo()) toast.showError("되돌리지 못했어요");
      },
    });
  };

  const list = (
    <ol className="mt-3 flex flex-col gap-2">
      {ids.map((id) => {
        const row = byId.get(id);
        if (!row) return null;
        const props = { row, onPick, onRemove: () => remove(id) };
        return sortable ? <SortableItem key={id} {...props} /> : <Item key={id} {...props} />;
      })}
      {p.playlist &&
        p.pending.map((x) => <PendingItem key={`pending-${x.clusterId}`} title={x.title} indent={sortable} onRemove={() => remove(x.clusterId)} />)}
    </ol>
  );
  const restore = removedCount > 0 && (
    <button
      type="button"
      onClick={p.restoreToday}
      disabled={!p.canRemove}
      className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl text-[14px] font-extrabold text-sky enabled:hover:bg-snow disabled:opacity-40"
    >
      뺀 소식 {removedCount}개 다시 넣기
    </button>
  );
  if (!sortable)
    return (
      <>
        {list}
        {restore}
      </>
    );
  return (
    <DndContext
      id="player-queue"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements: sortAnnouncements(titleOf, (id) => ids.indexOf(Number(id)) + 1), screenReaderInstructions: SORT_INSTRUCTIONS }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {list}
      </SortableContext>
    </DndContext>
  );
}

type ItemProps = { row: Row; onPick?: () => void; onRemove?: () => void };

function SortableItem(props: ItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.row.clusterId });
  return (
    <Item
      {...props}
      liRef={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      dragging={isDragging}
      handle={
        // 끌어서 옮기는 손잡이. 터치로 끌 때 화면이 스크롤되지 않게 touch-none
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`${props.row.title} 순서 옮기기`}
          className="flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-faint hover:bg-snow active:cursor-grabbing"
        >
          <IconGrip className="size-5" />
        </button>
      }
    />
  );
}

function Item({
  row,
  onPick,
  onRemove,
  liRef,
  style,
  dragging = false,
  handle,
}: ItemProps & { liRef?: (el: HTMLLIElement | null) => void; style?: React.CSSProperties; dragging?: boolean; handle?: React.ReactNode }) {
  const p = usePlayer();
  const { consumed } = useToday();
  const playing = p.status === "playing";
  const index = p.chapters.findIndex((c) => c.clusterId === row.clusterId);
  const ch = index >= 0 ? p.chapters[index] : undefined;
  // 듣는 동안은 듣기 시작할 때 읽은 소식 기준(플레이어가 실제로 건너뛰는 소식)
  const skipped = !!ch && p.skips(ch.clusterId);
  const current = index >= 0 && index === p.cur;
  const done = consumed(row.clusterId);
  const note = current ? (playing ? "듣는 중" : "멈춤") : skipped ? "건너뜀" : ch ? formatClock(ch.endMs - ch.startMs) : "";
  return (
    <li
      ref={liRef}
      style={style}
      className={`tile relative flex items-center ${handle ? "pl-1" : ""} ${current ? "border-sky bg-sky-tint" : ""} ${dragging ? "z-20 border-sky shadow-[0_8px_24px_rgba(0,0,0,0.12)]" : ""}`}
    >
      {handle}
      <button
        type="button"
        onClick={() => {
          // 고르기만 한다: 듣는 중이면 그 소식을 이어서 듣고, 멈췄으면 자리만 옮긴다(소리는 재생 버튼으로). 지금 소식은 그대로
          if (!current) p.select(index);
          onPick?.();
        }}
        disabled={!p.ready || index < 0}
        aria-current={current ? "step" : undefined}
        className={`grid min-h-12 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[inherit] py-2.5 text-left ${handle ? "pl-1 pr-3" : "px-3"} ${current ? "" : "enabled:hover:bg-snow"}`}
      >
        <span className={`flex min-w-0 items-center gap-1.5 text-[15px] font-extrabold ${skipped ? "text-faint line-through" : done && !current ? "text-sub" : ""}`}>
          {done && !current && <IconCheck className="size-4 shrink-0 text-leaf [stroke-width:3]" />}
          <span className="truncate">
            {done && !current && <span className="sr-only">들음, </span>}
            {row.title}
          </span>
        </span>
        <span className={`text-[13px] font-bold tabular-nums ${current ? "text-sky-dark" : "text-sub"}`}>{note}</span>
      </button>
      {onRemove && <RemoveButton title={row.title} onClick={onRemove} disabled={!p.canRemove} />}
    </li>
  );
}

function RemoveButton({ title, onClick, disabled = false }: { title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={`${title} 플레이어에서 빼기`}
      onClick={onClick}
      disabled={disabled}
      className="mr-1 flex size-10 shrink-0 items-center justify-center rounded-lg text-faint enabled:hover:bg-snow enabled:hover:text-sub disabled:opacity-40"
    >
      <IconClose className="size-[18px]" />
    </button>
  );
}

/** 플레이어에 추가했지만 음성을 만드는 중이라 아직 못 듣는 소식 */
function PendingItem({ title, indent, onRemove }: { title: string; indent: boolean; onRemove: () => void }) {
  return (
    <li className={`tile flex items-center ${indent ? "pl-1" : ""}`}>
      {indent && <span aria-hidden className="size-10 shrink-0" />}
      <div className={`grid min-h-12 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 ${indent ? "pl-1 pr-3" : "px-3"}`}>
        <span className="truncate text-[15px] font-extrabold text-sub">{title}</span>
        <span className="text-[13px] font-bold text-sky-dark">준비 중</span>
      </div>
      <RemoveButton title={title} onClick={onRemove} />
    </li>
  );
}
