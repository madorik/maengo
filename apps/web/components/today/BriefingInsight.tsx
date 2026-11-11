"use client";

import { IconCheck, IconChevronRight } from "@/components/icons";
import { useToday } from "@/components/providers/TodayProvider";
import type { BriefingInsight } from "@/lib/server/briefing-insight";

/**
 * 오늘의 흐름 카드(2026-11-11, lib/server/briefing-insight.ts). 오늘 화면 맨 위 숫자 아래, 듣기 막대 위.
 * 한 줄 + 흐름 2~3개(누르면 그 흐름의 첫 소식 카드로 내려가 잠깐 빛난다) + 확인할 것.
 * 서버가 만드는 동안은 같은 자리에 회색 줄(InsightSkeleton), 못 만들면 아무것도 그리지 않는다
 */
export function BriefingInsightView({ insight, pm, label }: { insight: BriefingInsight; pm: boolean; label: string }) {
  const sub = pm ? "text-white/70" : "text-sub";
  const goTo = (id: number) => {
    const el = document.querySelector<HTMLElement>(`[data-cluster="${id}"]`);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    el.animate?.([{ backgroundColor: "rgb(255 194 61 / 0.32)" }, { backgroundColor: "rgb(255 194 61 / 0)" }], { duration: 1600, easing: "ease-out", delay: reduce ? 0 : 350 });
  };
  return (
    <section aria-labelledby="insight-title" className={`mt-4 rounded-[22px] px-4 pb-2 pt-4 ${pm ? "bg-white/10" : "bg-snow"}`}>
      <p className={`text-[12px] font-bold ${pm ? "text-mango" : "text-mango-deep"}`}>{label}</p>
      <h2 id="insight-title" className="mt-1 text-[18px] font-bold leading-snug tracking-[-0.025em] text-balance">
        {insight.headline}
      </h2>
      <ul className="mt-2">
        {insight.flows.map((f) => (
          <li key={f.title}>
            <button type="button" onClick={() => goTo(f.ids[0]!)} className="flex w-full items-start gap-3 py-2.5 text-left">
              <span aria-hidden="true" className="mt-1 h-9 w-1 shrink-0 rounded-full bg-mango" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug tracking-[-0.02em]">{f.title}</span>
                <span className={`mt-0.5 block text-[14px] leading-relaxed ${sub}`}>{f.text}</span>
              </span>
              <IconChevronRight className={`mt-0.5 size-4 shrink-0 ${pm ? "text-white/50" : "text-faint"}`} />
            </button>
          </li>
        ))}
      </ul>
      {insight.checks.length > 0 && (
        <div className={`mb-2 mt-1 border-t pt-3 ${pm ? "border-white/15" : "border-line"}`}>
          <p className={`text-[12px] font-bold ${sub}`}>확인할 것</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {insight.checks.map((c) => (
              <li key={c.text}>
                <button type="button" onClick={() => goTo(c.id)} className="flex w-full items-start gap-2 text-left text-[14px] leading-relaxed">
                  <IconCheck className="mt-[3px] size-4 shrink-0 text-mango-deep [stroke-width:3]" />
                  <span>{c.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** 만드는 동안 같은 자리의 회색 줄(카드 높이를 미리 잡아 둬서 다 됐을 때 덜 밀린다) */
export function InsightSkeleton({ pm }: { pm: boolean }) {
  const bar = `rounded-full motion-safe:animate-pulse ${pm ? "bg-white/15" : "bg-line"}`;
  return (
    <div aria-hidden="true" className={`mt-4 rounded-[22px] px-4 py-4 ${pm ? "bg-white/10" : "bg-snow"}`}>
      <div className={`h-3 w-24 ${bar}`} />
      <div className={`mt-3 h-5 w-4/5 ${bar}`} />
      <div className={`mt-5 h-4 w-2/5 ${bar}`} />
      <div className={`mt-2 h-3.5 w-11/12 ${bar}`} />
      <div className={`mt-5 h-4 w-1/3 ${bar}`} />
      <div className={`mt-2 h-3.5 w-10/12 ${bar}`} />
    </div>
  );
}

/** 만드는 동안 보일 자리(오늘 화면의 브리핑 시간대를 따라 색을 맞춘다). 소식이 둘이 안 되면 흐름을 만들지 않아 비워 둔다 */
export function InsightFallback() {
  const { data } = useToday();
  return data.items.length > 1 ? <InsightSkeleton pm={data.slot === "pm"} /> : null;
}
