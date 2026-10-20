"use client";

import { track } from "@/lib/analytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { Bubble } from "@/components/ui/Bubble";
import { withBase } from "@/lib/base-path";
import type { TodayData } from "@/lib/types";
import { useCreep, useTick } from "./making";

type Progress =
  | { stage: "finding" }
  | { stage: "collecting" }
  | { stage: "found"; ready: number; toMake: number }
  | { stage: "summarizing"; done: number; total: number }
  | { stage: "saving" }
  | { stage: "done"; items: number }
  | { stage: "empty" }
  /** AI가 막혀(크레딧 소진·지출 상한) 새로 만들 수 없다 */
  | { stage: "blocked" }
  | { stage: "error" };

type State =
  | { kind: "idle" }
  | { kind: "running"; p: Progress }
  /** 다른 탭·기기(또는 아까 이 화면)에서 만드는 중이다(api/feed/today 409 already_running). 화면을 새로 그려 가며 기다린다(polls = 새로 그린 횟수) */
  | { kind: "waiting"; polls: number }
  | { kind: "empty" }
  | { kind: "blocked" }
  | { kind: "error" }
  /** 오늘 부를 수 있는 횟수를 다 썼다(api/feed/today 429) */
  | { kind: "limit" }
  | { kind: "done"; items: number };

/** 단계마다 진행 바가 머무를 구간. 서버 알림이 없는 동안에도 다음 구간 직전까지 조금씩 차오른다 */
function rangeOf(p: Progress): [number, number] {
  if (p.stage === "finding") return [0.03, 0.12];
  if (p.stage === "collecting") return [0.12, 0.45];
  if (p.stage === "found") return p.toMake ? [0.45, 0.47] : [0.5, 0.9];
  if (p.stage === "summarizing") {
    const step = 0.45 / Math.max(1, p.total);
    return [0.45 + step * p.done, 0.45 + step * (p.done + 1) - 0.02];
  }
  if (p.stage === "saving") return [0.92, 0.98];
  return [1, 1];
}

/** 구간 안에서 차오르는 빠르기(150ms마다 남은 거리의 이만큼). 오래 걸리는 단계는 천천히 차올라 멈춰 보이지 않게 한다 */
function paceOf(p: Progress): number {
  if (p.stage === "collecting") return 0.012;
  if (p.stage === "summarizing") return 0.008;
  return 0.05;
}

/** 진행 중에 돌아가며 보여 줄 말. 단계에 맞춰 바뀐다 */
function cheersOf(p: Progress): string[] {
  if (p.stage === "finding") return ["관심사에 맞는 소식을 찾고 있어요", "맹고가 신문 더미를 뒤적이는 중이에요"];
  if (p.stage === "collecting") return ["따끈한 새 소식을 모으고 있어요", "여기저기서 소식을 주워 담는 중이에요", "조금만 기다려 주세요~", "맹고가 열심히 뛰어다니고 있어요"];
  if (p.stage === "summarizing")
    return [
      `소식 ${p.total}개를 만들고 있어요~`,
      "맹고가 열심히 기사를 읽고 있어요",
      "핵심만 쏙쏙 골라 담는 중이에요",
      "조금만 기다려 주세요~",
      p.done === 0 ? "첫 번째 소식을 정리하는 중이에요" : p.done < p.total ? `${p.done}개 완성! 나머지도 금방이에요` : "다 만들었어요! 담는 중이에요",
    ];
  if (p.stage === "found")
    return p.toMake
      ? [`소식 ${p.ready + p.toMake}개를 찾았어요! ${p.toMake}개는 지금 새로 만들게요`]
      : [`이미 준비된 소식 ${p.ready}개를 찾았어요!`, "오늘 목록에 예쁘게 담는 중이에요"];
  if (p.stage === "saving") return ["거의 다 됐어요! 오늘 목록에 담는 중이에요"];
  if (p.stage === "done") return [`오늘의 소식 ${p.items}개가 준비됐어요!`];
  return ["오늘의 소식을 만들고 있어요"];
}

/** 스크린리더에는 돌아가는 말 대신 단계만 알린다 */
function stageLabel(p: Progress): string {
  if (p.stage === "collecting") return "새 소식을 모으는 중";
  if (p.stage === "summarizing") return `소식 ${p.total}개 중 ${p.done}개 요약함`;
  if (p.stage === "found") return `소식 ${p.ready + p.toMake}개 찾음`;
  if (p.stage === "saving") return "오늘 목록에 담는 중";
  if (p.stage === "done") return `오늘의 소식 ${p.items}개 준비됨`;
  return "관심사에 맞는 소식을 찾는 중";
}

/** 만드는 동안 보이는 카드: 차오르는 줄무늬 진행 바와 몇 초마다 바뀌는 말 */
function Making({ p }: { p: Progress }) {
  const [lo, hi] = rangeOf(p);
  // 다음 구간 직전까지 천천히 다가간다(구간이 바뀌면 그 바닥부터). 말은 2.6초마다 바뀐다
  const shown = useCreep(lo, hi, paceOf(p));
  const tick = useTick(2600);
  const done = p.stage === "done";

  const cheers = cheersOf(p);
  const line = cheers[tick % cheers.length]!;
  const pct = Math.round((done ? 1 : shown) * 100);
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
        <div role="progressbar" aria-label="오늘의 소식 만드는 중" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-4 flex-1 overflow-hidden rounded-full bg-line">
          <div className={`h-full rounded-full bg-sky transition-[width] duration-300 ease-out ${done ? "" : "stripes"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right font-round text-[14px] font-black tabular-nums text-sky-dark" aria-hidden>
          {pct}%
        </span>
      </div>
    </div>
  );
}

/** 단계마다 최소 이만큼은 보여 준다(이미 준비된 소식을 가져오면 1초도 안 걸려 진행이 안 보이므로) */
const MIN_STAGE_MS = 700;
/** 다 되면 이만큼 '준비됐어요'를 보여 주고 목록으로 넘어간다 */
const DONE_HOLD_MS = 1200;
/** 다 됐는데 이만큼 지나도 목록으로 안 바뀌면(새로 그린 화면에도 보일 소식이 없음) 받기 버튼으로 되돌린다 */
const DONE_GIVE_UP_MS = 15_000;
/** 다른 곳에서 만드는 중이면 이 간격으로 화면을 새로 그려 본다 */
const BUILDING_POLL_MS = 5_000;
/** 기다리기 시작해 이만큼 새로 그려도 서버가 만드는 중(building)이라 하지 않으면 그사이 끝난 것이라 받기 버튼으로 되돌린다 */
const WAIT_POLLS = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 이 탭에서 '오늘 소식 받기'가 도는 중인지. 오늘 데이터(emptyReason)는 (app) 레이아웃이 들고 있어 화면을 옮겨도 다시 읽지 않으므로,
 * 만드는 중에 다른 화면에 갔다 돌아와 이 화면이 새로 붙으면 이것을 보고 받기 버튼 대신 기다린다(다른 탭·기기는 409, 새로 열면 서버의 'building')
 */
let buildingHere = false;

/**
 * 오늘의 맹고가 비었을 때(가입 직후 첫 방문은 늘, 그 뒤엔 새벽 배치 전): "오늘 소식 받기"를 누르면 이미 요약된 소식을 가져오고 없으면 지금 만든다.
 * 서버가 보내는 진행 상황(찾기 → (고를 게 없으면) 새 소식 모으기 → 요약 n/N → 담기)에 맞춰 진행 바와 말을 바꾸고, 끝나면 화면을 새로 그린다.
 * 다른 탭·기기에서 만드는 중이거나(409 already_running) 만드는 중에 화면을 옮겼다 돌아오면(서버 emptyReason 'building') 받기 버튼 대신
 * 만드는 중으로 보여 주고, 소식이 생길 때까지 화면을 새로 그린다.
 */
export function MakeToday({ reason, notifyLabel }: { reason: TodayData["emptyReason"]; notifyLabel: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>(() => (buildingHere ? { kind: "waiting", polls: 0 } : { kind: "idle" }));
  // 이 화면이 직접 만드는 중이면 그 진행을 보여 주고, 아니면 서버가 만드는 중이라 할 때 기다린다
  const othersBuilding = state.kind === "waiting" || (reason === "building" && state.kind !== "running" && state.kind !== "done");

  // 알림 시각이 돼 배송이 만드는 중이면 20초마다 다시 본다(보통 1~2분 안에 온다)
  useEffect(() => {
    if (reason !== "arriving") return;
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [reason, router]);

  // 다른 곳에서 만드는 중이면 소식이 생길 때까지 다시 본다(생기면 이 화면은 목록으로 바뀐다)
  useEffect(() => {
    if (!othersBuilding) return;
    const t = setInterval(() => {
      if (state.kind === "waiting") {
        if (reason !== "building" && state.polls >= WAIT_POLLS) return setState({ kind: "idle" });
        setState({ kind: "waiting", polls: state.polls + 1 });
      }
      router.refresh();
    }, BUILDING_POLL_MS);
    return () => clearInterval(t);
  }, [othersBuilding, state, reason, router]);

  // 다 됐다고 했는데 목록으로 안 바뀌면 받기 버튼으로 되돌린다
  useEffect(() => {
    if (state.kind !== "done") return;
    const t = setTimeout(() => setState({ kind: "idle" }), DONE_HOLD_MS + DONE_GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [state.kind]);

  const start = async () => {
    track("today_build", { reason: reason ?? "none" });
    setState({ kind: "running", p: { stage: "finding" } });
    let shownAt = Date.now();
    const show = async (next: State) => {
      const wait = MIN_STAGE_MS - (Date.now() - shownAt);
      if (wait > 0) await sleep(wait);
      setState(next);
      shownAt = Date.now();
    };
    // 진행을 받기 시작한 뒤에 끊기면(앱이 뒤로 감 등) 서버는 끝까지 만든다. 그때는 화면을 새로 그려 만드는 중이면 기다린다
    let streaming = false;
    try {
      const res = await fetch(withBase("/api/feed/today"), { method: "POST" });
      // 그사이 오늘 소식이 생겼거나(다른 기기·배송) 알림 시각 전이면 화면을 새로 그린다. 하루 횟수를 다 썼으면 그렇다고만
      if (res.status === 409) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        if (error === "already_built" || error === "scheduled") {
          setState({ kind: "idle" });
          return router.refresh();
        }
        // 다른 탭·기기(또는 아까 이 화면)에서 만드는 중이다
        if (error === "already_running") {
          setState({ kind: "waiting", polls: 0 });
          return router.refresh();
        }
      }
      if (res.status === 429) return setState({ kind: "limit" });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      streaming = true;
      buildingHere = true;
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
          if (last.stage === "empty") await show({ kind: "empty" });
          else if (last.stage === "blocked") await show({ kind: "blocked" });
          else if (last.stage === "error") await show({ kind: "error" });
          else if (last.stage === "done") await show({ kind: "done", items: last.items });
          else await show({ kind: "running", p: last });
        }
      }
      if (last?.stage === "done") {
        await sleep(DONE_HOLD_MS);
        router.refresh();
      } else if (!last || (last.stage !== "empty" && last.stage !== "blocked" && last.stage !== "error")) {
        // 끝을 못 받고 끊겼다
        setState({ kind: "error" });
        router.refresh();
      }
    } catch {
      setState({ kind: "error" });
      if (streaming) router.refresh();
    } finally {
      buildingHere = false;
    }
  };

  if (state.kind === "running" || state.kind === "done") {
    return <Making p={state.kind === "done" ? { stage: "done", items: state.items } : state.p} />;
  }

  // 다른 탭·기기에서, 또는 만드는 중에 화면을 옮겼다 돌아왔을 때(받기 버튼 없음)
  if (othersBuilding) {
    return (
      <div className="mt-10 flex items-end gap-3">
        <Mascot mood="listen" className="bob size-24 shrink-0" />
        <Bubble className="mb-6 flex-1">
          <p role="status" className="text-[15px] font-bold leading-relaxed">
            오늘의 소식을 만들고 있어요. 곧 도착해요.
          </p>
        </Bubble>
      </div>
    );
  }

  // 알림 시각이 돼 배송이 만드는 중(받기 버튼 없음)
  if (reason === "arriving") {
    return (
      <div className="mt-10 flex items-end gap-3">
        <Mascot mood="happy" className="size-24 shrink-0" />
        <Bubble className="mb-6 flex-1">
          <p className="text-[15px] font-bold leading-relaxed">오늘의 소식을 준비하고 있어요. 곧 도착해요.</p>
          <Link href="/library" className="mt-2 inline-block text-[15px] font-extrabold text-sky">
            지난 소식 보기
          </Link>
        </Bubble>
      </div>
    );
  }

  return (
    <div className="mt-10 flex items-end gap-3">
      <Mascot mood={state.kind === "error" || state.kind === "blocked" || state.kind === "limit" ? "happy" : "cheer"} className="size-24 shrink-0" />
      <Bubble className="mb-6 flex-1">
        {state.kind === "limit" ? (
          <p className="text-[15px] font-bold leading-relaxed">오늘은 더 받을 수 없어요. 내일 다시 시도해 주세요.</p>
        ) : state.kind === "empty" ? (
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
              {state.kind === "blocked"
                ? "지금은 요청량이 많아 새 소식을 만들 수 없어요. 조금 뒤에 다시 시도해주세요."
                : state.kind === "error"
                ? "오늘의 소식을 만들지 못했어요. 잠시 뒤 다시 눌러 주세요."
                : reason === "first"
                  ? "첫 소식을 받아 볼까요?"
                  : reason === "scheduled"
                    ? `오늘의 소식은 ${notifyLabel}에 와요.`
                  : reason === "exhausted"
                    ? "관심사에서 고른 소식을 다 봤어요. 새로 들어온 소식이 있는지 찾아볼까요?"
                    : "아직 오늘의 소식이 없어요. 지금 바로 만들어 드릴까요?"}
            </p>
            <button type="button" onClick={start} className="btn mt-3 w-full">
              {state.kind === "error" || state.kind === "blocked" ? "다시 받기" : reason === "scheduled" ? "오늘 소식 지금 받기" : "오늘 소식 받기"}
            </button>
            {reason === "scheduled" && (
              <Link href="/library" className="mt-2 block text-center text-[15px] font-extrabold text-sky">
                지난 소식 보기
              </Link>
            )}
          </>
        )}
      </Bubble>
    </div>
  );
}
