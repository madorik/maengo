"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconPlus } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { useProfile } from "@/components/providers/ProfileProvider";
import { track } from "@/lib/analytics";
import { withBase } from "@/lib/base-path";
import { useCreep, useTick } from "./making";

type Progress =
  | { stage: "finding" }
  | { stage: "collecting" }
  | { stage: "found"; ready: number; toMake: number }
  | { stage: "summarizing"; done: number; total: number }
  | { stage: "saving" }
  | { stage: "done"; items: number }
  | { stage: "empty" }
  | { stage: "blocked" }
  | { stage: "error" };

type State = { kind: "idle" } | { kind: "running"; p: Progress } | { kind: "error"; message: string };

const ERRORS: Record<string, string> = {
  already_running: "다른 곳에서 만드는 중이에요. 잠시 뒤 다시 열어 주세요.",
  scheduled: "지금은 알림 시각이라 배송을 기다려요. 잠시 뒤 다시 눌러 주세요.",
  no_feed: "오늘 소식을 먼저 받아 주세요.",
  daily_cap: "오늘은 더 받을 수 없어요.",
  empty: "최근 한 달 동안 관심사에 맞는 새 소식이 없어요.",
  blocked: "지금은 요청량이 많아 새 소식을 만들 수 없어요. 조금 뒤에 다시 시도해주세요.",
  failed: "더 받지 못했어요. 다시 눌러 주세요.",
};

/** 단계마다 진행 바가 머무를 구간(새 소식 모으기 단계는 없다). 서버 알림이 없는 동안에도 다음 구간 직전까지 조금씩 차오른다 */
function rangeOf(p: Progress): [number, number] {
  if (p.stage === "finding") return [0.04, 0.28];
  if (p.stage === "found") return p.toMake ? [0.3, 0.33] : [0.5, 0.9];
  if (p.stage === "summarizing") {
    const step = 0.58 / Math.max(1, p.total);
    return [0.3 + step * p.done, 0.3 + step * (p.done + 1) - 0.02];
  }
  if (p.stage === "saving") return [0.92, 0.98];
  return [1, 1];
}

/** 구간 안에서 차오르는 빠르기. 요약은 오래 걸려 천천히 */
const paceOf = (p: Progress) => (p.stage === "summarizing" ? 0.01 : 0.05);

/** 진행 중에 돌아가며 보여 줄 말(2026-10-20 사용자 요청: 관심사 확인 → 찾는 중 → AI 요약 → 거의 다 됨). name = 회원 이름(없으면 이름 없이) */
function cheersOf(p: Progress, name: string | null): string[] {
  if (p.stage === "finding")
    return [name ? `${name}님의 관심사를 확인하고 있어요!` : "관심사를 확인하고 있어요!", "열심히 찾고 있어요!", "최근 한 달 소식을 샅샅이 뒤지는 중이에요!"];
  if (p.stage === "found") return p.toMake ? [`소식 ${p.ready + p.toMake}개를 찾았어요!`, `${p.toMake}개는 AI로 새로 요약할게요!`] : [`준비된 소식 ${p.ready}개를 찾았어요!`];
  if (p.stage === "summarizing")
    return p.done >= p.total
      ? ["거의 다 됐어요!"]
      : ["AI로 요약하고 있어요!", "핵심만 쏙쏙 골라 담고 있어요!", p.done === 0 ? "첫 번째 소식을 정리하고 있어요!" : `${p.done}개 완성! 나머지도 금방이에요!`, "조금만 기다려 주세요!"];
  if (p.stage === "saving") return ["거의 다 됐어요!", "오늘 목록에 담고 있어요!"];
  if (p.stage === "done") return [`소식 ${p.items}개를 더 받았어요!`];
  return ["남은 소식을 찾고 있어요!"];
}

function subOf(p: Progress): string {
  if (p.stage === "summarizing") return `${p.total}개 중 ${p.done}개 완성`;
  if (p.stage === "saving" || p.stage === "done") return "곧 화면에 보여 드릴게요";
  return "1분쯤 걸릴 수 있어요";
}

/** 스크린리더에는 돌아가는 말 대신 단계만 알린다 */
function stageLabel(p: Progress): string {
  if (p.stage === "summarizing") return `소식 ${p.total}개 중 ${p.done}개 요약함`;
  if (p.stage === "found") return `소식 ${p.ready + p.toMake}개 찾음`;
  if (p.stage === "saving") return "오늘 목록에 담는 중";
  if (p.stage === "done") return `소식 ${p.items}개 더 받음`;
  return "남은 소식을 찾는 중";
}

/** 받는 동안 버튼 자리에 보이는 카드: 마스코트, 2초마다 바뀌는 말, 차오르는 줄무늬 막대 */
function Filling({ p, name }: { p: Progress; name: string | null }) {
  const [lo, hi] = rangeOf(p);
  const shown = useCreep(lo, hi, paceOf(p));
  const tick = useTick(2200);
  const done = p.stage === "done";
  const cheers = cheersOf(p, name);
  const line = cheers[tick % cheers.length]!;
  const pct = Math.round((done ? 1 : shown) * 100);
  return (
    <div className="mt-3 rounded-xl bg-white/60 px-3 py-3">
      <p role="status" className="sr-only">
        {stageLabel(p)}
      </p>
      <div className="flex items-center gap-3">
        <Mascot mood={done ? "cheer" : "listen"} className={`size-12 shrink-0 ${done ? "pop" : "bob"}`} />
        <div className="min-w-0 flex-1" aria-hidden>
          <p key={line} className="swap text-[16px] font-black leading-snug">
            {line}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-ink/70">{subOf(p)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div role="progressbar" aria-label="남은 소식 받는 중" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-3 flex-1 overflow-hidden rounded-full bg-white/70">
          <div className={`h-full rounded-full bg-sky transition-[width] duration-300 ease-out ${done ? "" : "stripes"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right font-round text-[13px] font-black tabular-nums" aria-hidden>
          {pct}%
        </span>
      </div>
    </div>
  );
}

/** 단계마다 최소 이만큼은 보여 준다(찾기 → 찾음이 1초도 안 걸리면 진행이 안 보이므로) */
const MIN_STAGE_MS = 700;
/** 다 되면 이만큼 '더 받았어요'를 보여 주고 새로 그린다(소식 수가 바뀌면 이 버튼은 사라지거나 남은 수가 줄어든다) */
const DONE_HOLD_MS = 1200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 오늘 카드 진행 막대 아래 '남은 소식 N개 받기'(2026-10-20 사용자 결정): 오늘 받은 소식이 플랜의 하루 소식보다 적을 때(배송이 적게 준 날)
 * 모자란 만큼 지금 채운다. 하루 소식 안이라 맹고를 쓰지 않는다. 서버(api/feed/today/fill)가 흘려보내는 진행(찾기 → 요약 n/N → 담기)에 맞춰
 * 버튼 자리에 진행 카드(Filling)를 보여 주고, 끝나면 화면을 새로 그린다. onExpect·onSettle은 '하나 더 받기'와 같이 새로 붙은 소식으로 스크롤하고 짚는 데 쓴다(arrival.ts)
 */
export function FillToday({ remaining, onExpect, onSettle }: { remaining: number; onExpect?: (keyboard: boolean) => void; onSettle?: (ok: boolean) => void }) {
  const router = useRouter();
  const profile = useProfile();
  const [state, setState] = useState<State>({ kind: "idle" });

  const start = async (e: React.MouseEvent<HTMLButtonElement>) => {
    track("today_fill", { remaining });
    // 키보드(Enter·Space)로 누른 클릭은 detail이 0이다
    onExpect?.(e.detail === 0);
    setState({ kind: "running", p: { stage: "finding" } });
    let shownAt = Date.now();
    const show = async (p: Progress) => {
      const wait = MIN_STAGE_MS - (Date.now() - shownAt);
      if (wait > 0) await sleep(wait);
      setState({ kind: "running", p });
      shownAt = Date.now();
    };
    let last: Progress | null = null;
    try {
      const res = await fetch(withBase("/api/feed/today/fill"), { method: "POST" });
      if (res.status === 409 || res.status === 429) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        onSettle?.(false);
        // 그사이 다 채워졌으면(다른 기기 등) 화면만 새로 그린다
        if (error === "nothing_left") {
          setState({ kind: "idle" });
          return router.refresh();
        }
        return setState({ kind: "error", message: ERRORS[error ?? ""] ?? ERRORS.failed! });
      }
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          last = JSON.parse(line) as Progress;
          if (last.stage !== "empty" && last.stage !== "blocked" && last.stage !== "error") await show(last);
        }
      }
      if (last?.stage === "done") {
        await sleep(DONE_HOLD_MS);
        onSettle?.(true);
        setState({ kind: "idle" });
        router.refresh();
      } else {
        onSettle?.(false);
        const key = last?.stage === "empty" || last?.stage === "blocked" ? last.stage : "failed";
        setState({ kind: "error", message: ERRORS[key]! });
        // 끝을 못 받고 끊겼어도 서버는 끝까지 채우니 새로 그려 본다
        if (key === "failed") router.refresh();
      }
    } catch {
      onSettle?.(false);
      setState({ kind: "error", message: ERRORS.failed! });
      router.refresh();
    }
  };

  if (state.kind === "running") return <Filling p={state.p} name={profile.displayName} />;
  return (
    <div className="mt-3">
      <button type="button" onClick={start} className="btn btn-ink w-full min-h-11 text-[14px]">
        <IconPlus className="size-5" />
        {`남은 소식 ${remaining}개 받기`}
      </button>
      {state.kind === "error" && (
        <p role="alert" className="mt-2 px-1 text-[13px] font-bold text-cherry">
          {state.message}
        </p>
      )}
    </div>
  );
}
