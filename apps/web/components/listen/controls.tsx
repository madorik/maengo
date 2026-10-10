"use client";

import { VOICES } from "@maengo/core/audio";
import { IconCheck } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { formatClock, isSkipped } from "@/lib/player/machine";

export { Switch } from "@/components/ui/Switch";

/** 재생 목록. 누르면 그 소식부터 */
export function Queue({ onPick }: { onPick?: () => void }) {
  const p = usePlayer();
  const { data, read, consumed } = useToday();
  const playing = p.status === "playing";
  // 플레이리스트면 고른 소식(챕터 표), 아니면 오늘 피드. 순번은 플레이리스트 안의 순서다
  const rows = p.playlist ? p.chapters.map((ch) => ({ clusterId: ch.clusterId, title: ch.title, rank: ch.rank })) : data.items;
  return (
    <ol className="mt-3 flex flex-col gap-2">
      {rows.map((item, i) => {
        const ch = p.chapters[i];
        const skipped = !!ch && !p.playlist && isSkipped(ch, read, p.skipRead);
        const current = i === p.cur;
        const done = consumed(item.clusterId);
        const note = current ? (playing ? "듣는 중" : "멈춤") : skipped ? "건너뜀" : ch ? formatClock(ch.endMs - ch.startMs) : "";
        return (
          <li key={item.clusterId}>
            <button
              type="button"
              onClick={() => {
                p.goTo(i);
                onPick?.();
              }}
              disabled={!p.ready}
              aria-current={current ? "step" : undefined}
              className={`tile grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-left ${current ? "border-sky bg-sky-tint" : "enabled:hover:bg-snow"}`}
            >
              <span
                className={`flex size-8 items-center justify-center rounded-full font-round text-[15px] font-black ${
                  current ? "bg-sky text-white" : done ? "bg-leaf-bright text-white" : "bg-line text-sub"
                }`}
              >
                {done && !current ? <IconCheck className="size-5 [stroke-width:3]" /> : item.rank}
              </span>
              <span className={`truncate text-[15px] font-extrabold ${skipped ? "text-faint line-through" : ""}`}>{item.title}</span>
              <span className={`text-[13px] font-bold tabular-nums ${current ? "text-sky-dark" : "text-sub"}`}>{note}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function VoicePicker() {
  const p = usePlayer();
  if (p.persona === "dialogue") {
    return <p className="mt-4 text-[14px] font-semibold leading-relaxed text-sub">대담은 진행자와 해설자, 두 목소리가 함께 나와요.</p>;
  }
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {VOICES.map((v) => {
        const on = v.id === p.voice;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={on}
            onClick={() => p.setVoice(v.id)}
            className={`tile min-h-12 text-[15px] font-extrabold ${on ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}
          >
            {v.label} 목소리
          </button>
        );
      })}
    </div>
  );
}
