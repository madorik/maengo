"use client";

import { track } from "@/lib/analytics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { notifyTimeLabel } from "@maengo/core/kst";
import { withBase } from "@/lib/base-path";
import { floorToMinute, remainingText, upcomingBriefings } from "@/lib/briefing-clock";
import type { EmptyPlan } from "@/lib/today-empty";
import type { TodayData } from "@/lib/types";
import { useCreep, useTick } from "./making";
import { briefingName, PickedInterests, Timetable } from "./NextBriefing";

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
  return ["브리핑을 만들고 있어요"];
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

/**
 * 오늘 소식이 아직 없을 때의 남색 카드 틀(2026-11-26 시안, 주간 리포트 결론 카드 VerdictFrame과 같은 방식): 작은 이름표(망고 노랑) + 큰 제목 + 한 줄 + 안쪽 내용.
 * 다크에서도 같은 남색이라 안쪽 글자는 흰색·구분선은 white/12로 직접 적고(토큰이 다크에서 뒤집힌다), 눈에 보이는 포커스 링도 남색 위에서 보이게 망고 노랑으로 바꾼다.
 * heading을 끄면(제목이 몇 초마다 바뀌는 진행 카드) 제목은 화면 읽기에서 빼고 카드 이름표로 구역을 알린다
 */
function Card({ label, title, sub, big = false, heading = true, children }: { label: string; title: ReactNode; sub?: ReactNode; big?: boolean; heading?: boolean; children?: ReactNode }) {
  const size = big ? "text-[28px] leading-[1.25]" : "text-[22px] leading-[1.35]";
  return (
    <section
      aria-labelledby={heading ? "empty-title" : undefined}
      aria-label={heading ? undefined : label}
      className="rounded-3xl bg-[#1F2340] px-5 pb-5 pt-[22px] text-white [--color-focus:#FFC23D]"
    >
      <p className="text-[13px] font-extrabold text-mango">{label}</p>
      {heading ? (
        <h2 id="empty-title" className={`mt-1.5 font-extrabold tracking-[-0.05em] text-balance ${size}`}>
          {title}
        </h2>
      ) : (
        <p aria-hidden className={`mt-1.5 font-extrabold tracking-[-0.05em] text-balance ${size}`}>
          {title}
        </p>
      )}
      {sub && <p className="mt-1 text-[15px] font-medium leading-[1.55] text-white/72 text-pretty">{sub}</p>}
      {children}
    </section>
  );
}

/** 만드는 동안 보이는 카드: 같은 남색 카드 안에 차오르는 줄무늬 진행 바와 몇 초마다 바뀌는 말 */
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
    <Card
      label="브리핑 만드는 중"
      heading={false}
      title={
        <span key={line} className="swap block">
          {line}
        </span>
      }
      sub={done ? "곧 화면에 보여 드릴게요" : p.stage === "summarizing" ? `${p.total}개 중 ${p.done}개 완성` : "1~2분쯤 걸릴 수 있어요"}
    >
      <p role="status" className="sr-only">
        {stageLabel(p)}
      </p>
      <div className="mt-5 flex items-center gap-3">
        <div role="progressbar" aria-label="브리핑 만드는 중" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-3.5 flex-1 overflow-hidden rounded-full bg-white/18">
          <div className={`h-full rounded-full bg-mango transition-[width] duration-300 ease-out ${done ? "" : "stripes"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right font-round text-[14px] font-black tabular-nums text-mango" aria-hidden>
          {pct}%
        </span>
      </div>
    </Card>
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

/** 분이 바뀌는 때를 알린다(10초마다 보고, 탭이 다시 보일 때도 본다. 값이 같으면 화면은 다시 그려지지 않는다) */
function subscribeMinute(cb: () => void) {
  const id = setInterval(cb, 10_000);
  document.addEventListener("visibilitychange", cb);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", cb);
  };
}

/**
 * 지금 시각(분 단위로 내린 ms). 서버가 그린 때(serverNow)로 처음 그려 서버 그림과 어긋나지 않게 하고, 그 뒤부터 이 기기 시계로 1분마다 바뀐다.
 * 화면을 옮겨 다니다 돌아온 새 그림(하이드레이션이 아님)은 처음부터 이 기기 시계를 쓴다
 */
function useMinuteClock(serverNow: number): number {
  return useSyncExternalStore(subscribeMinute, () => floorToMinute(Date.now()), () => serverNow);
}

/** 알림 시각 전 남은 시간이 이만큼(분) 이하면 서버 판단이 바뀌었는지(배송 시작) 화면을 새로 그려 본다. 서버가 '배송 기다림'으로 보는 알림 6분 전(lib/server/feed.ts DELIVERY_LEAD_MS)과 같다 */
const ARRIVAL_LEAD_MIN = 6;

/**
 * 오늘의 맹고가 비었을 때(가입 직후 첫 방문은 늘, 그 뒤엔 새벽 배치 전): "오늘 소식 받기"를 누르면 이미 요약된 소식을 가져오고 없으면 지금 만든다.
 * 화면은 남색 카드 하나(2026-11-26 시안 '오늘 소식 오기 전'): 알림 시각 전(scheduled)이면 '다음 브리핑 n분 뒤에 와요' + 하루 시간표 + 내 관심사 + 주 버튼 '기다리지 않고 지금 받기'.
 * 다른 상태(첫 방문·배송 중·만드는 중·배치 전·다 봄)도 같은 카드 틀에 그 상태의 문구와 동작을 담고, 시간표는 시각이 정해진 알림 전에만 둔다.
 * plan은 서버가 읽은 알림 시각·관심사(없으면 아직 읽는 중이라 시간표·관심사 없이 그린다).
 * 서버가 보내는 진행 상황(찾기 → (고를 게 없으면) 새 소식 모으기 → 요약 n/N → 담기)에 맞춰 진행 바와 말을 바꾸고, 끝나면 화면을 새로 그린다.
 * 다른 탭·기기에서 만드는 중이거나(409 already_running) 만드는 중에 화면을 옮겼다 돌아오면(서버 emptyReason 'building') 받기 버튼 대신
 * 만드는 중으로 보여 주고, 소식이 생길 때까지 화면을 새로 그린다.
 */
export function MakeToday({ reason, notifyLabel, plan }: { reason: TodayData["emptyReason"]; notifyLabel: string; plan: EmptyPlan | null }) {
  const router = useRouter();
  const [state, setState] = useState<State>(() => (buildingHere ? { kind: "waiting", polls: 0 } : { kind: "idle" }));
  // 이 화면이 직접 만드는 중이면 그 진행을 보여 주고, 아니면 서버가 만드는 중이라 할 때 기다린다
  const othersBuilding = state.kind === "waiting" || (reason === "building" && state.kind !== "running" && state.kind !== "done");

  // 알림 시각 전(scheduled)의 다음 브리핑: 서버가 그린 때에서 시작해 1분마다 이 기기 시계로 센다. 알림 시각이 코앞이면 화면을 새로 그려 배송이 시작됐는지 본다
  const nowMs = useMinuteClock(plan?.nowMs ?? 0);
  const upcoming = plan && reason === "scheduled" ? upcomingBriefings(plan.notifyAt, plan.notifyAtPm, nowMs) : null;
  const soon = state.kind === "idle" && !!upcoming && upcoming[0].inMin <= ARRIVAL_LEAD_MIN;
  useEffect(() => {
    if (soon) router.refresh();
  }, [soon, nowMs, router]);

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
      <Card label="브리핑 만드는 중" title="오늘의 소식을 만들고 있어요" sub="곧 도착해요.">
        <p role="status" className="sr-only">
          오늘의 소식을 만들고 있어요. 곧 도착해요.
        </p>
      </Card>
    );
  }

  // 알림 시각이 돼 배송이 만드는 중(받기 버튼 없음)
  if (reason === "arriving") {
    return (
      <Card label="다음 브리핑" title="브리핑을 준비하고 있어요" sub="곧 도착해요.">
        <Link href="/library" className="mt-2 inline-flex min-h-11 items-center text-[15px] font-extrabold text-mango underline underline-offset-[3px]">
          지난 소식 보기
        </Link>
      </Card>
    );
  }

  const failed = state.kind === "limit" || state.kind === "empty" || state.kind === "blocked" || state.kind === "error";
  // 받기 버튼 앞에 놓는 시간표·관심사는 아직 아무것도 누르지 않았을 때만(결과 문구가 나오면 그 문구가 자리를 쓴다)
  const resting = !failed;
  const showInterests = resting && (reason === "scheduled" || reason === "first" || reason === "waiting");
  // 이름표: 출근길 시각 전이면 '다음 브리핑', 그 뒤라면 어느 브리핑인지('다음 브리핑 · 퇴근길')
  const next = upcoming?.[0];
  const label =
    reason === "scheduled"
      ? next && !(next.slot === "am" && !next.tomorrow)
        ? `다음 브리핑 · ${briefingName(next)}`
        : "다음 브리핑"
      : reason === "first"
        ? "첫 브리핑"
        : "오늘 브리핑";

  // 이 카드의 큰 제목과 한 줄. 결과 문구(횟수·소식 없음·막힘·실패)와 상태별 문구는 예전 말 그대로이고 문장 끝에서 둘로 나눴을 뿐이다
  let title: ReactNode;
  let sub: ReactNode = undefined;
  if (state.kind === "limit") {
    title = "오늘은 더 받을 수 없어요.";
    sub = "내일 다시 시도해 주세요.";
  } else if (state.kind === "empty") {
    title = "방금 새 소식까지 모아 봤지만 최근 사흘 동안 새 소식이 없었어요.";
    sub = "다음 브리핑에서 다시 찾아 드릴게요.";
  } else if (state.kind === "blocked") {
    title = "지금은 요청량이 많아 새 소식을 만들 수 없어요.";
    sub = "조금 뒤에 다시 시도해주세요.";
  } else if (state.kind === "error") {
    title = "브리핑을 만들지 못했어요.";
    sub = "잠시 뒤 다시 눌러 주세요.";
  } else if (reason === "first") {
    title = "첫 소식을 받아 볼까요?";
  } else if (reason === "scheduled") {
    if (upcoming && plan) {
      const at = notifyTimeLabel(upcoming[0].at);
      const when = `${upcoming[0].tomorrow ? "내일 " : ""}${at}`;
      title = remainingText(upcoming[0].inMin);
      sub = plan.pushEnabled ? `${when}, 알림으로 알려 드릴게요` : `${when}에 준비돼요. 앱을 열면 받을 수 있어요`;
    } else {
      title = `오늘의 소식은 ${notifyLabel}에 와요.`;
    }
  } else if (reason === "exhausted") {
    title = "관심사에서 고른 소식을 다 봤어요.";
    sub = "새로 들어온 소식이 있는지 찾아볼까요?";
  } else {
    title = "아직 브리핑이 없어요.";
    sub = "지금 바로 만들어 드릴까요?";
  }

  return (
    <Card label={label} title={title} sub={sub} big={resting && reason === "scheduled" && !!upcoming}>
      {resting && upcoming && <Timetable nowMs={nowMs} next={upcoming[0]} after={upcoming[1]} />}
      {showInterests && plan && <PickedInterests interests={plan.interests} count={plan.perBriefing} />}
      {state.kind !== "limit" && state.kind !== "empty" && (
        <button type="button" onClick={start} className="btn mt-[18px] h-[54px] w-full font-extrabold">
          {state.kind === "error" || state.kind === "blocked" ? "다시 받기" : reason === "scheduled" ? "기다리지 않고 지금 받기" : "오늘 소식 받기"}
        </button>
      )}
    </Card>
  );
}
