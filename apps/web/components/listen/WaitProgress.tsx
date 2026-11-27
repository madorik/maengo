"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/components/providers/ProfileProvider";
import { waitFill, waitShort, waitStageAt } from "@/lib/player/labels";

// 음성을 만드는 동안 보여 주는 진행(2026-11-27 사용자: 만드는 10초 동안 지루하지 않게, 기다릴 수 있는 시간을 알려 주자).
// 서버는 진행을 알려 주지 않아서 기다린 시간으로 막대를 채운다: 어림 시간(Free 약 12초, Premium 약 6초)까지 곧게 차고 끝을 모르니 다 채우지는 않는다.
// 말은 기다린 시간의 단계(lib/player/labels.ts waitStages: 처음 → 곧 → 늦어짐)를 따른다. 시각은 플레이어가 기다리기 시작한 때(waitSince)부터 세서
// 막대의 고리·플레이어 창·듣기 화면이 같은 진행을 보이고, 창을 도중에 열어도 그 자리부터 보인다. 시각을 안 주면(글 하나 듣기) 그린 때부터.
// 화면을 안 보는 사람(출퇴근 이어폰)은 같은 때 같은 말을 안내 음성으로 듣는다(public/voice-samples/wait-*.mp3)

/** 이만큼 넘게 기다릴 때만 그린다(이미 만든 음성은 파일만 받으면 바로 나와서 잠깐 번쩍이지 않게) */
const SHOW_AFTER_MS = 700;

/** since(없으면 그린 때)부터 기다린 시간(ms), 200ms마다 */
function useElapsed(since?: number | null): number {
  const [mounted] = useState(() => Date.now());
  const start = since ?? mounted;
  const [now, setNow] = useState(mounted);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, now - start);
}

/** 플레이어 창·듣기 화면·글 듣기 막대의 기다림 칸: 무엇을 하는지, 얼마나 걸리는지, 어디까지 왔는지, 취소 */
export function WaitProgress({ since, onCancel, className = "" }: { since?: number | null; onCancel?: () => void; className?: string }) {
  const { audio: premium } = useProfile();
  const elapsed = useElapsed(since);
  if (elapsed < SHOW_AFTER_MS) return null;
  const stage = waitStageAt(elapsed, premium);
  return (
    <div className={`rounded-2xl bg-snow py-2.5 pl-3.5 pr-2 ${className}`}>
      <div className="flex items-center gap-2">
        <div role="status" className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-snug text-ink">{stage.title}</p>
          <p className="mt-0.5 text-[13px] font-medium leading-snug text-sub">{stage.note}</p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost min-h-11 shrink-0 px-3 text-[14px]">
            취소
          </button>
        )}
      </div>
      <div className="mt-2.5 mr-1.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div
          className="h-full rounded-full bg-mango transition-[width] duration-200 ease-linear motion-reduce:transition-none"
          style={{ width: `${Math.round(waitFill(elapsed, premium) * 1000) / 10}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 떠 있는 플레이어 막대의 재생 버튼을 두르는 진행 고리(막대만 보이는 오늘 화면에서도 어디까지 왔는지 보이게).
 * 부모(버튼을 감싼 relative 칸)에 꽉 차게 겹쳐 그린다. 누르는 건 막지 않는다
 */
export function WaitRing({ since }: { since: number | null }) {
  const { audio: premium } = useProfile();
  const elapsed = useElapsed(since);
  if (elapsed < SHOW_AFTER_MS) return null;
  const r = 26;
  const len = 2 * Math.PI * r;
  const fill = waitFill(elapsed, premium);
  return (
    <svg viewBox="0 0 56 56" className="pointer-events-none absolute -inset-1 size-14 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="2.5" className="stroke-line" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - fill)}
        className="stroke-mango transition-[stroke-dashoffset] duration-200 ease-linear motion-reduce:transition-none"
      />
    </svg>
  );
}

/** 떠 있는 막대의 둘째 줄(좁은 자리): '목소리 만드는 중, 10초쯤' → '곧 들려 드릴게요' → '조금 더 걸리고 있어요' */
export function WaitShort({ since }: { since: number | null }) {
  const { audio: premium } = useProfile();
  const elapsed = useElapsed(since);
  return <>{waitShort(waitStageAt(elapsed, premium), premium)}</>;
}
