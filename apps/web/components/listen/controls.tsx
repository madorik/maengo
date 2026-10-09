"use client";

import { PERSONAS, VOICES } from "@maengo/core/audio";
import type { Persona } from "@maengo/core/types";
import { IconCap, IconChat, IconCheck, IconMic } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { formatClock, isSkipped } from "@/lib/player/machine";
import { minutesLabel } from "@/lib/player/labels";

const PERSONA_ICON: Record<Persona, typeof IconMic> = { announcer: IconMic, teacher: IconCap, dialogue: IconChat };

/** 켜고 끄는 스위치 */
export function Switch({ label, note, checked, onChange }: { label: string; note?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold">{label}</span>
        {note && <span className="mt-0.5 block truncate text-[13px] font-semibold text-sub">{note}</span>}
      </span>
      <span className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors ${checked ? "justify-end bg-sky" : "justify-start bg-line"}`}>
        <span className="size-6 rounded-full bg-white shadow-[0_2px_0_rgb(0_0_0/0.15)]" />
      </span>
    </button>
  );
}

/** 재생 목록. 누르면 그 소식부터 */
export function Queue({ onPick }: { onPick?: () => void }) {
  const p = usePlayer();
  const { data, read, consumed } = useToday();
  const playing = p.status === "playing";
  return (
    <ol className="mt-3 flex flex-col gap-2">
      {data.items.map((item, i) => {
        const ch = p.chapters[i];
        const skipped = !!ch && isSkipped(ch, read, p.skipRead);
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

/** 말투 고르기 */
export function PersonaPicker() {
  const p = usePlayer();
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {PERSONAS.map((info) => {
        const on = info.id === p.persona;
        const Icon = PERSONA_ICON[info.id];
        return (
          <button
            key={info.id}
            type="button"
            aria-pressed={on}
            onClick={() => p.setPersona(info.id)}
            className={`tile flex min-h-[112px] flex-col items-center justify-center gap-1 px-1.5 py-3 ${on ? "border-sky bg-sky-tint" : "hover:bg-snow"}`}
          >
            <Icon className={`size-8 ${on ? "text-sky" : "text-sub"}`} />
            <span className={`text-[16px] font-black ${on ? "text-sky-dark" : ""}`}>{info.name}</span>
            <span className="text-[12px] font-bold text-sub">{info.shortDesc}</span>
            <span className="text-[12px] font-bold text-sub">{minutesLabel(p.personaTotalMs(info.id))}</span>
          </button>
        );
      })}
    </div>
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
