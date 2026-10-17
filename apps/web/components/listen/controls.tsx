"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { IconCheck, IconGrip } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { SORT_INSTRUCTIONS, sortAnnouncements } from "@/components/ui/sortable-a11y";
import { formatClock, isSkipped } from "@/lib/player/machine";

export { Switch } from "@/components/ui/Switch";

type Row = { clusterId: number; title: string; rank: number };

/**
 * 재생 목록. 누르면 그 소식부터(지금 듣는 소식은 그대로).
 * 플레이리스트를 들을 때는 손잡이를 끌어 순서를 바꾼다(PlayerProvider.reorderPlaylist: 듣던 자리에서 이어 가고 플레이리스트에도 저장).
 * 음성 조각이 다 있을 때만 끌 수 있다(새 순서로 이어 붙이기만 하면 된다)
 */
export function Queue({ onPick }: { onPick?: () => void }) {
  const p = usePlayer();
  const { data } = useToday();
  // 플레이리스트면 고른 소식(챕터 표), 아니면 오늘 피드. 순번은 플레이리스트 안의 순서다
  const rows: Row[] = p.playlist ? p.chapters.map((ch) => ({ clusterId: ch.clusterId, title: ch.title, rank: ch.rank })) : data.items;
  const sortable = !!p.playlist && p.audioReady && !p.preparing;

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

  const list = (
    <ol className="mt-3 flex flex-col gap-2">
      {ids.map((id, i) => {
        const row = byId.get(id);
        if (!row) return null;
        const props = { row, position: p.playlist ? i + 1 : row.rank, onPick };
        return sortable ? <SortableItem key={id} {...props} /> : <Item key={id} {...props} />;
      })}
    </ol>
  );
  if (!sortable) return list;
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

type ItemProps = { row: Row; position: number; onPick?: () => void };

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
  position,
  onPick,
  liRef,
  style,
  dragging = false,
  handle,
}: ItemProps & { liRef?: (el: HTMLLIElement | null) => void; style?: React.CSSProperties; dragging?: boolean; handle?: React.ReactNode }) {
  const p = usePlayer();
  const { read, consumed } = useToday();
  const playing = p.status === "playing";
  const index = p.chapters.findIndex((c) => c.clusterId === row.clusterId);
  const ch = index >= 0 ? p.chapters[index] : undefined;
  const skipped = !!ch && !p.playlist && isSkipped(ch, read, p.skipRead);
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
          // 지금 듣는 소식을 누르면 처음으로 돌리지 않는다(멈춰 있었으면 그 자리부터 이어서)
          if (!current) p.goTo(index);
          else if (!playing) p.play();
          onPick?.();
        }}
        disabled={!p.ready || index < 0}
        aria-current={current ? "step" : undefined}
        className={`grid min-w-0 flex-1 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[inherit] py-2.5 text-left ${handle ? "pl-1 pr-3" : "px-3"} ${current ? "" : "enabled:hover:bg-snow"}`}
      >
        <span
          className={`flex size-8 items-center justify-center rounded-full font-round text-[15px] font-black ${
            current ? "bg-sky text-white" : done ? "bg-leaf-bright text-white" : "bg-line text-sub"
          }`}
        >
          {done && !current ? <IconCheck className="size-5 [stroke-width:3]" /> : position}
        </span>
        <span className={`truncate text-[15px] font-extrabold ${skipped ? "text-faint line-through" : ""}`}>{row.title}</span>
        <span className={`text-[13px] font-bold tabular-nums ${current ? "text-sky-dark" : "text-sub"}`}>{note}</span>
      </button>
    </li>
  );
}
