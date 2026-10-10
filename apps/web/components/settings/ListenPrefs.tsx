"use client";

import { VOICES } from "@maengo/core/audio";
import type { Voice } from "@maengo/core/types";
import { useEffect, useRef, useState } from "react";
import { IconPause, IconPlay } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { sampleUrl } from "@/lib/voice-samples";

/**
 * 설정 > 듣기 모드: 목소리(여성·남성). 말투는 아나운서 하나다. 고르면 바로 저장되고(profiles.voice),
 * 오늘 전체 듣기와 글 하나 듣기가 모두 이 목소리로 시작한다. 듣는 중에 듣기 창에서 바꾼 것도 같은 값이다.
 * 목소리마다 위에 미리 듣기가 있어 고르기 전에 들어 볼 수 있다. 미리 만들어 둔 짧은 인사(public/voice-samples)라 Free도 들을 수 있다.
 */
export function ListenPrefs({ audio }: { audio: boolean }) {
  const p = usePlayer();
  // 샘플은 audio 하나로 튼다(다른 목소리를 누르면 듣던 것은 멈춘다)
  const ref = useRef<HTMLAudioElement>(null);
  const current = useRef<Voice | null>(null);
  const [playing, setPlaying] = useState<Voice | null>(null);
  const [failed, setFailed] = useState<Voice | null>(null);

  // 화면에서 빠진 audio도 계속 소리를 내므로 직접 멈춘다
  useEffect(() => {
    const a = ref.current;
    return () => a?.pause();
  }, []);

  const preview = (v: Voice) => {
    const a = ref.current;
    if (!a) return;
    if (playing === v) return a.pause();
    p.pause(); // 오늘 브리핑이 돌고 있었다면 멈춘다
    const src = sampleUrl(p.persona, v);
    if (current.current !== v || failed === v) {
      a.src = src;
      a.load();
    }
    current.current = v;
    setFailed(null);
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  return (
    <>
      <p className="text-sub">듣기를 누르면 아나운서 말투로 읽어 드려요. 목소리만 골라 주세요. 듣는 중에도 듣기 창에서 바꿀 수 있어요.</p>
      <audio
        ref={ref}
        preload="none"
        onPlay={() => setPlaying(current.current)}
        onPause={() => setPlaying(null)}
        onEnded={() => setPlaying(null)}
        onError={() => {
          setPlaying(null);
          setFailed(current.current);
        }}
      />
      <div className="mt-4 grid grid-cols-2 gap-2">
        {VOICES.map((v) => {
          const on = v.id === p.voice;
          const label = `${v.label} 목소리`;
          const now = playing === v.id;
          return (
            <div key={v.id} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => preview(v.id)}
                aria-label={`${label} ${now ? "미리 듣기 멈추기" : "미리 듣기"}`}
                title={failed === v.id ? "샘플을 불러오지 못했어요" : undefined}
                className="btn btn-ghost inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-[14px]"
              >
                {now ? <IconPause className="size-4" /> : <IconPlay className="size-4" />}
                {failed === v.id ? "다시 시도" : now ? "멈추기" : "미리 듣기"}
              </button>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => p.setVoice(v.id)}
                className={`tile min-h-12 text-[15px] font-extrabold ${on ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
      {!audio && <p className="mt-1 text-[13px] text-sub">듣기는 Premium에서 쓸 수 있어요. 목소리는 미리 들어 보고 골라 둘 수 있어요.</p>}
    </>
  );
}
