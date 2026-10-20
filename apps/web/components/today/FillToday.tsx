"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconPlus } from "@/components/icons";
import { track } from "@/lib/analytics";
import { withBase } from "@/lib/base-path";

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

/** 진행 단계를 버튼 글자로 */
function labelOf(p: Progress): string {
  if (p.stage === "summarizing") return `새 소식 만드는 중 ${p.done}/${p.total}`;
  if (p.stage === "found" && p.toMake > 0) return `새 소식 ${p.toMake}개 만드는 중`;
  if (p.stage === "saving" || p.stage === "done") return "오늘 목록에 담는 중";
  return "남은 소식 찾는 중";
}

/** 다 되면 이만큼 '담는 중'을 보여 주고 새로 그린다(소식 수가 바뀌면 이 버튼은 사라지거나 남은 수가 줄어든다) */
const DONE_HOLD_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 오늘 카드 진행 막대 아래 '남은 소식 N개 받기'(2026-10-20 사용자 결정): 오늘 받은 소식이 플랜의 하루 소식보다 적을 때(배송이 적게 준 날)
 * 모자란 만큼 지금 채운다. 하루 소식 안이라 맹고를 쓰지 않는다. 서버(api/feed/today/fill)가 흘려보내는 진행(찾기 → 요약 n/N → 담기)을 버튼 글자로 보여 주고,
 * 끝나면 화면을 새로 그린다. onExpect·onSettle은 '하나 더 받기'와 같이 새로 붙은 소식으로 스크롤하고 짚는 데 쓴다(arrival.ts)
 */
export function FillToday({ remaining, onExpect, onSettle }: { remaining: number; onExpect?: (keyboard: boolean) => void; onSettle?: (ok: boolean) => void }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  const start = async (e: React.MouseEvent<HTMLButtonElement>) => {
    track("today_fill", { remaining });
    // 키보드(Enter·Space)로 누른 클릭은 detail이 0이다
    onExpect?.(e.detail === 0);
    setState({ kind: "running", p: { stage: "finding" } });
    let last: Progress | null = null;
    try {
      const res = await fetch(withBase("/api/feed/today/fill"), { method: "POST" });
      if (res.status === 409 || res.status === 429) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        // 그사이 다 채워졌으면(다른 기기 등) 화면만 새로 그린다
        if (error === "nothing_left") {
          setState({ kind: "idle" });
          onSettle?.(false);
          return router.refresh();
        }
        onSettle?.(false);
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
          if (last.stage !== "empty" && last.stage !== "blocked" && last.stage !== "error") setState({ kind: "running", p: last });
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

  const running = state.kind === "running";
  return (
    <div className="mt-3">
      <button type="button" onClick={start} disabled={running} aria-busy={running} className="btn btn-ink w-full min-h-11 text-[14px]">
        <IconPlus className="size-5" />
        {running ? labelOf(state.p) : `남은 소식 ${remaining}개 받기`}
      </button>
      {state.kind === "error" && (
        <p role="alert" className="mt-2 px-1 text-[13px] font-bold text-cherry">
          {state.message}
        </p>
      )}
    </div>
  );
}
