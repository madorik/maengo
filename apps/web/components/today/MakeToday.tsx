"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconCheck } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";
import { ProgressBar } from "@/components/ui/ProgressBar";

type Progress =
  | { stage: "finding" }
  | { stage: "summarizing"; done: number; total: number }
  | { stage: "saving" }
  | { stage: "done"; items: number }
  | { stage: "empty" }
  | { stage: "error" };

type State = { kind: "idle" } | { kind: "running"; p: Progress } | { kind: "empty" } | { kind: "error" } | { kind: "done"; items: number };

const STEPS = ["관심사에 맞는 소식 찾기", "읽고 요약하기", "오늘 목록 담기"] as const;

function stepOf(p: Progress): number {
  if (p.stage === "finding") return 0;
  if (p.stage === "summarizing") return 1;
  return 2;
}

/**
 * 오늘의 맹고가 비었을 때(가입 직후, 새벽 배치 전): "오늘 맹고 받기"를 누르면 이 사람 것을 지금 만든다.
 * 서버가 보내는 진행 상황(찾기 → 요약 n/N → 담기)을 그대로 보여 주고, 끝나면 화면을 새로 그린다.
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
    const p: Progress = state.kind === "done" ? { stage: "done", items: state.items } : state.p;
    const step = stepOf(p);
    const ratio = p.stage === "finding" ? 0.12 : p.stage === "summarizing" ? 0.2 + 0.65 * (p.done / Math.max(1, p.total)) : p.stage === "saving" ? 0.92 : 1;
    return (
      <div className="tile mt-6 p-5" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <Mascot mood={state.kind === "done" ? "cheer" : "listen"} className={`size-16 shrink-0 ${state.kind === "done" ? "" : "bob"}`} />
          <div className="min-w-0">
            <p className="text-[18px] font-black">{state.kind === "done" ? `오늘의 맹고 ${state.items}개가 준비됐어요!` : "오늘의 맹고를 만들고 있어요"}</p>
            <p className="mt-0.5 text-[14px] font-semibold text-sub">
              {p.stage === "summarizing"
                ? `맹고가 기사를 읽고 요약하는 중이에요 (${p.done}/${p.total})`
                : p.stage === "finding"
                  ? "관심사에 맞는 소식을 고르는 중이에요"
                  : p.stage === "saving"
                    ? "오늘 목록에 담는 중이에요"
                    : "곧 화면에 보여 드릴게요"}
            </p>
          </div>
        </div>
        <ProgressBar value={ratio} tone="sky" label="오늘의 맹고 만드는 중" className="mt-4 h-3" />
        <ol className="mt-4 flex flex-col gap-2">
          {STEPS.map((label, i) => {
            const done = state.kind === "done" || i < step;
            const now = state.kind !== "done" && i === step;
            return (
              <li key={label} className={`flex items-center gap-2 text-[14px] font-bold ${done ? "text-leaf" : now ? "text-ink" : "text-faint"}`}>
                <span className={`flex size-5 items-center justify-center rounded-full border-2 ${done ? "border-leaf bg-leaf text-white" : now ? "border-sky" : "border-line"}`}>
                  {done && <IconCheck className="size-3 [stroke-width:3.5]" />}
                </span>
                {label}
                {now && p.stage === "summarizing" && <span className="font-round text-sub">{` ${p.done}/${p.total}`}</span>}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[12px] font-semibold text-faint">처음 한 번만 1분쯤 걸려요. 이 화면에서 잠시만 기다려 주세요.</p>
      </div>
    );
  }

  return (
    <div className="mt-10 flex items-end gap-3">
      <Mascot mood={state.kind === "error" ? "happy" : "cheer"} className="size-24 shrink-0" />
      <Bubble className="mb-6 flex-1">
        {state.kind === "empty" ? (
          <>
            <p className="text-[15px] font-bold leading-relaxed">
              아직 이 관심사로 모인 소식이 없어요. 매일 새벽 새 소식을 모으니 내일 아침에 다시 와 주세요.
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
