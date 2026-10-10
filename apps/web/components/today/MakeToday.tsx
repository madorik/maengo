"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";

type Progress =
  | { stage: "finding" }
  | { stage: "collecting" }
  | { stage: "summarizing"; done: number; total: number }
  | { stage: "saving" }
  | { stage: "done"; items: number }
  | { stage: "empty" }
  | { stage: "error" };

type State = { kind: "idle" } | { kind: "running"; p: Progress } | { kind: "empty" } | { kind: "error" } | { kind: "done"; items: number };

/** 단계마다 진행 바가 머무를 구간. 서버 알림이 없는 동안에도 다음 구간 직전까지 조금씩 차오른다 */
function rangeOf(p: Progress): [number, number] {
  if (p.stage === "finding") return [0.03, 0.12];
  if (p.stage === "collecting") return [0.12, 0.45];
  if (p.stage === "summarizing") {
    const step = 0.45 / Math.max(1, p.total);
    return [0.45 + step * p.done, 0.45 + step * (p.done + 1) - 0.02];
  }
  if (p.stage === "saving") return [0.92, 0.98];
  return [1, 1];
}

/** 진행 중에 돌아가며 보여 줄 말. 단계에 맞춰 바뀐다 */
function cheersOf(p: Progress): string[] {
  if (p.stage === "finding") return ["관심사에 맞는 소식을 찾고 있어요", "맹고가 신문 더미를 뒤적이는 중이에요"];
  if (p.stage === "collecting") return ["따끈한 새 소식을 모으고 있어요", "여기저기서 소식을 주워 담는 중이에요", "조금만 기다려 주세요~", "맹고가 열심히 뛰어다니고 있어요"];
  if (p.stage === "summarizing")
    return [
      `맹고 ${p.total}개를 만들고 있어요~`,
      "맹고가 열심히 기사를 읽고 있어요",
      "핵심만 쏙쏙 골라 담는 중이에요",
      "조금만 기다려 주세요~",
      p.done ? `${p.done}개 완성! 나머지도 금방이에요` : "첫 번째 맹고를 빚는 중이에요",
    ];
  if (p.stage === "saving") return ["거의 다 됐어요! 오늘 목록에 담는 중이에요"];
  if (p.stage === "done") return [`오늘의 맹고 ${p.items}개가 준비됐어요!`];
  return ["오늘의 맹고를 만들고 있어요"];
}

/** 스크린리더에는 돌아가는 말 대신 단계만 알린다 */
function stageLabel(p: Progress): string {
  if (p.stage === "collecting") return "새 소식을 모으는 중";
  if (p.stage === "summarizing") return `소식 ${p.total}개 중 ${p.done}개 요약함`;
  if (p.stage === "saving") return "오늘 목록에 담는 중";
  if (p.stage === "done") return `오늘의 맹고 ${p.items}개 준비됨`;
  return "관심사에 맞는 소식을 찾는 중";
}

/** 만드는 동안 보이는 카드: 차오르는 줄무늬 진행 바와 몇 초마다 바뀌는 말 */
function Making({ p }: { p: Progress }) {
  const [lo, hi] = rangeOf(p);
  const [shown, setShown] = useState(lo);
  const [tick, setTick] = useState(0);
  const done = p.stage === "done";

  // 다음 구간 직전까지 천천히 다가간다(구간이 바뀌면 그 바닥부터)
  useEffect(() => {
    const id = setInterval(() => setShown((v) => Math.max(lo, v + (hi - Math.max(lo, v)) * 0.035)), 150);
    return () => clearInterval(id);
  }, [lo, hi]);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2600);
    return () => clearInterval(id);
  }, []);

  const cheers = cheersOf(p);
  const line = cheers[tick % cheers.length]!;
  const pct = Math.round((done ? 1 : Math.max(lo, shown)) * 100);
  return (
    <div className="tile mt-6 p-5">
      <p role="status" className="sr-only">
        {stageLabel(p)}
      </p>
      <div className="flex items-center gap-3">
        <Mascot mood={done ? "cheer" : "listen"} className={`size-16 shrink-0 ${done ? "pop" : "bob"}`} />
        <div className="min-w-0 flex-1" aria-hidden>
          <p key={line} className="swap text-[18px] font-black leading-snug">
            {line}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-sub">
            {done ? "곧 화면에 보여 드릴게요" : p.stage === "summarizing" ? `${p.total}개 중 ${p.done}개 완성` : "1~2분쯤 걸릴 수 있어요"}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div role="progressbar" aria-label="오늘의 맹고 만드는 중" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-4 flex-1 overflow-hidden rounded-full bg-line">
          <div className={`h-full rounded-full bg-sky transition-[width] duration-300 ease-out ${done ? "" : "stripes"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right font-round text-[14px] font-black tabular-nums text-sky-dark" aria-hidden>
          {pct}%
        </span>
      </div>
    </div>
  );
}

/**
 * 오늘의 맹고가 비었을 때(가입 직후, 새벽 배치 전): "오늘 맹고 받기"를 누르면 이 사람 것을 지금 만든다.
 * 서버가 보내는 진행 상황(찾기 → (고를 게 없으면) 새 소식 모으기 → 요약 n/N → 담기)에 맞춰 진행 바와 말을 바꾸고, 끝나면 화면을 새로 그린다.
 */
export function MakeToday({ reason }: { reason: "waiting" | "exhausted" | null }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  const start = async () => {
    setState({ kind: "running", p: { stage: "finding" } });
    try {
      const res = await fetch("/api/feed/today", { method: "POST" });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let last: Progress | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          last = JSON.parse(line) as Progress;
          if (last.stage === "empty") setState({ kind: "empty" });
          else if (last.stage === "error") setState({ kind: "error" });
          else if (last.stage === "done") setState({ kind: "done", items: last.items });
          else setState({ kind: "running", p: last });
        }
      }
      if (last?.stage === "done") router.refresh();
      else if (!last || (last.stage !== "empty" && last.stage !== "error")) setState({ kind: "error" });
    } catch {
      setState({ kind: "error" });
    }
  };

  if (state.kind === "running" || state.kind === "done") {
    return <Making p={state.kind === "done" ? { stage: "done", items: state.items } : state.p} />;
  }

  return (
    <div className="mt-10 flex items-end gap-3">
      <Mascot mood={state.kind === "error" ? "happy" : "cheer"} className="size-24 shrink-0" />
      <Bubble className="mb-6 flex-1">
        {state.kind === "empty" ? (
          <>
            <p className="text-[15px] font-bold leading-relaxed">
              방금 새 소식까지 모아 봤지만 최근 사흘 동안 이 관심사 소식이 없었어요. 관심사를 더하면 바로 다시 찾아 드릴게요.
            </p>
            <Link href="/settings#topics" className="mt-2 inline-block text-[15px] font-extrabold text-sky">
              관심사 넓히기
            </Link>
          </>
        ) : (
          <>
            <p className="text-[15px] font-bold leading-relaxed">
              {state.kind === "error"
                ? "오늘의 맹고를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요."
                : reason === "exhausted"
                  ? "관심사에서 고른 소식을 다 봤어요. 새로 들어온 소식이 있는지 찾아볼까요?"
                  : "아직 오늘의 맹고가 없어요. 지금 바로 만들어 드릴까요?"}
            </p>
            <button type="button" onClick={start} className="btn mt-3 w-full">
              {state.kind === "error" ? "다시 받기" : "오늘 맹고 받기"}
            </button>
          </>
        )}
      </Bubble>
    </div>
  );
}
