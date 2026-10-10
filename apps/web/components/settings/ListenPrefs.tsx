"use client";

import { useEffect, useRef, useState } from "react";
import { IconPause, IconPlay } from "@/components/icons";
import { VoicePicker } from "@/components/listen/controls";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { sampleUrl } from "@/lib/voice-samples";

/**
 * 설정 > 듣기: 목소리(여성·남성). 말투는 아나운서 하나다. 고르면 바로 저장되고(profiles.voice),
 * 오늘 전체 듣기와 글 하나 듣기가 모두 이 목소리로 시작한다. 듣는 중에 듣기 창에서 바꾼 것도 같은 값이다.
 * 미리 듣기는 미리 만들어 둔 짧은 인사(public/voice-samples)라 Free도 들을 수 있다.
 */
export function ListenPrefs({ audio }: { audio: boolean }) {
  const p = usePlayer();
  const label = p.voice === "f" ? "여성 목소리" : "남성 목소리";
  return (
    <>
      <p className="text-sub">듣기를 누르면 아나운서 말투로 읽어 드려요. 목소리만 골라 주세요. 듣는 중에도 듣기 창에서 바꿀 수 있어요.</p>
      <VoicePicker />
      <div className="mt-4 flex items-center justify-between gap-3">
        <p aria-live="polite" className="min-w-0 text-[14px] font-bold text-leaf">
          지금 기본값: {label}
        </p>
        <SampleButton key={sampleUrl(p.persona, p.voice)} src={sampleUrl(p.persona, p.voice)} label={label} onStart={p.pause} />
      </div>
      {!audio && <p className="mt-1 text-[13px] text-sub">듣기는 Premium에서 쓸 수 있어요. 목소리는 미리 들어 보고 골라 둘 수 있어요.</p>}
    </>
  );
}

/**
 * 고른 목소리의 샘플을 틀고 멈춘다. src마다 새로 그려서(key) 목소리를 바꾸면 듣던 샘플은 멈춘다.
 * 아직 안 만든 샘플(TTS 무료 한도로 나눠 만든다)은 처음에 HEAD로 확인해 '준비 중'으로 막아 둔다.
 */
function SampleButton({ src, label, onStart }: { src: string; label: string; onStart: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);

  // 화면에서 빠진 audio도 계속 소리를 내므로 직접 멈춘다
  useEffect(() => {
    const a = ref.current;
    return () => a?.pause();
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    fetch(src, { method: "HEAD", signal: ctl.signal })
      .then((r) => setMissing(r.status === 404))
      .catch(() => {});
    return () => ctl.abort();
  }, [src]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (playing) return a.pause();
    onStart(); // 오늘 브리핑이 돌고 있었다면 멈춘다
    setFailed(false);
    if (failed) a.load();
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  return (
    <>
      <audio
        ref={ref}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={missing}
        aria-label={missing ? `${label} 미리 듣기는 준비 중이에요` : `${label} ${playing ? "미리 듣기 멈추기" : "미리 듣기"}`}
        title={failed ? "샘플을 불러오지 못했어요" : undefined}
        className="btn btn-ghost inline-flex min-h-11 shrink-0 items-center gap-1.5 px-4 text-[14px]"
      >
        {playing ? <IconPause className="size-4" /> : <IconPlay className="size-4" />}
        {missing ? "준비 중" : failed ? "다시 시도" : playing ? "멈추기" : "미리 듣기"}
      </button>
    </>
  );
}
