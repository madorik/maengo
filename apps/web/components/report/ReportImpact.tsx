"use client";

import Link from "next/link";
import { useState } from "react";
import { IconCalendar } from "@/components/icons";
import { ToneIcon } from "@/components/ui/ToneIcon";
import { ReportSection, VERDICT_CHIP, VERDICT_DOT, VERDICT_LONG, VerdictFrame, VerdictPill } from "./parts";

// 관심사 두 칸(2026-11-26 사용자: 핵심 내용을 우선순위로 세워 읽기 쉽게): ① 맨 위 '지난주 한 줄' 상자의 관심사별 판정 줄 ② '관심사별로 자세히'.
// 줄을 누르면 아래 자세히 칸이 그 관심사로 바뀌고 그리로 스크롤한다(둘이 한 상태를 나누려고 한 클라이언트 칸에 둔다).
// 자세히 칸: 판정 알약, 제목·풀이, 가까운 시장 지표의 한 주 선 그래프(소식이 나온 날을 판정 색 점으로), 흐름을 바꾼 소식, 이번 주 볼 것.
// 값은 서버가 다 계산해서 넘긴다(ReportBody.impactViews). 판정 = 그 관심사에 닿은 소식을 쪽마다 센 것 중 많은 쪽(같으면 지켜볼 변수), 막대 색은 dataviz 검사를 통과한 plus-mark·minus-mark(globals.css).

export type ImpactTone = "plus" | "minus" | "watch";

export interface ImpactChart {
  name: string;
  last: string;
  change: string;
  /** 한 주 등락 방향(숫자 색: 오르면 빨강, 내리면 파랑이 증권 관례, 2026-11-25 6안) */
  dir: "up" | "down" | "flat";
  /** 한 주 거래일(요일 이름과 값) */
  points: { label: string; value: number }[];
  /** 소식이 나온 날(points 자리)과 그 소식의 쪽 */
  marks: { index: number; tone: ImpactTone; title: string }[];
  /** 그래프를 말로(화면 읽기 프로그램) */
  spoken: string;
}

export interface ImpactView {
  about: string;
  /** 판정(쪽별 소식 수 중 많은 쪽, 같으면 지켜볼 변수) */
  tone: ImpactTone;
  title: string;
  text: string;
  next?: string;
  counts: Record<ImpactTone, number>;
  news: { href: string; title: string; day: string | null; tone: ImpactTone | null }[];
  chart: ImpactChart | null;
}

/** 등락 숫자 색(오름 빨강 계열 text-minus, 내림 파랑 text-plus가 증권 관례. 지금 화면 규칙) */
// 지표 등락은 색 없이 ▲▼만(판단 색과 섞이지 않게, 지난주 시장 칸과 같은 규칙)
const DIR_COLOR = { up: "text-ink/80", down: "text-ink/80", flat: "text-sub" } as const;

export function ReportImpact({ headline, interests, footnote }: { headline: string; interests: ImpactView[]; footnote?: React.ReactNode }) {
  const [at, setAt] = useState(0);
  const cur = interests[Math.min(at, interests.length - 1)];
  if (!cur) return null;
  const show = (i: number) => {
    setAt(i);
    // 판정 줄에서 눌렀을 때만 자세히 칸 머리로(움직임 줄이기를 켠 사람은 바로)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("report-detail")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  return (
    <>
      <div>
        <VerdictFrame headline={headline} lines>
          <ul aria-label="관심사별 판정" className="mt-4">
            {interests.map((x, i) => (
              <li key={`${x.about}-${i}`} className="border-t border-ink/10">
                <button
                  type="button"
                  aria-controls="report-detail"
                  onClick={() => show(i)}
                  className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-2.5 rounded-xl px-2 py-[13px] text-left transition-colors hover:bg-ink/5 active:bg-ink/5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-extrabold leading-[1.35] tracking-[-0.03em]">{x.about}</span>
                    <span className="mt-0.5 line-clamp-2 block text-[14px] font-medium leading-[1.45] text-ink/80">{x.title}</span>
                  </span>
                  <VerdictPill tone={x.tone} />
                  <span className="sr-only">{`, 자세히 보기`}</span>
                </button>
              </li>
            ))}
          </ul>
        </VerdictFrame>
        {footnote && <p className="mt-2.5 px-1 text-[13px] font-medium leading-normal text-sub">{footnote}</p>}
      </div>

      <div id="report-detail" className="scroll-mt-[72px]">
        <ReportSection id="report-impact" title="관심사별로 자세히" lead="관심사마다 무엇이 흐름을 바꿨는지 풀어 드려요">
          <div role="group" aria-label="관심사" className="mt-3.5 flex flex-wrap gap-2">
            {interests.map((x, i) => {
              const on = i === at;
              return (
                <button
                  key={`${x.about}-${i}`}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAt(i)}
                  className={`inline-flex h-[38px] items-center rounded-full px-[15px] text-[14.5px] font-bold transition-colors ${on ? "bg-ink text-paper" : "bg-snow text-ink hover:bg-line"}`}
                >
                  {x.about}
                </button>
              );
            })}
          </div>

          <article aria-live="polite" className="mt-3 rounded-[22px] border border-line px-5 pb-5 pt-[22px]">
            <span className={`inline-flex h-[26px] items-center gap-1 rounded-full px-2.5 text-[12.5px] font-extrabold ${VERDICT_CHIP[cur.tone]}`}>
              <ToneIcon tone={cur.tone} />
              {VERDICT_LONG[cur.tone]}
            </span>
            <h3 className="mt-2.5 text-[19px] font-extrabold leading-[1.45] tracking-[-0.04em] text-balance">{cur.title}</h3>
            <p className="mt-2 text-[15px] font-medium leading-[1.7] text-ink/80">{cur.text}</p>

            {cur.chart && <MetricChart chart={cur.chart} />}

            {cur.news.length > 0 && (
              <>
                <h4 className="mt-5 text-[15px] font-extrabold">흐름을 바꾼 소식</h4>
                <ul className="mt-1.5">
                  {cur.news.map((n) => (
                    <li key={n.href}>
                      <Link href={n.href} className="flex min-h-11 items-start gap-2.5 py-2.5 no-underline hover:text-mango-deep">
                        <span className="w-[18px] shrink-0 text-[13px] font-bold leading-[1.7] text-sub">{n.day ?? ""}</span>
                        <span aria-hidden="true" className={`mt-[9px] size-2 shrink-0 rounded-full ${n.tone ? VERDICT_DOT[n.tone] : "bg-line-dark"}`} />
                        <span className="min-w-0 text-[15px] font-semibold leading-[1.55]">
                          {n.title}
                          {n.tone && <span className="sr-only">{`, ${VERDICT_LONG[n.tone]}`}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {cur.next && (
              <div className="mt-3 flex gap-2.5 rounded-[14px] bg-mango-tint p-3.5">
                <IconCalendar className="mt-0.5 size-[18px] shrink-0 text-mango-deep" />
                <p className="min-w-0 text-[14.5px] font-semibold leading-[1.6]">
                  <b className="font-extrabold text-mango-deep">이번 주 볼 것</b> {cur.next}
                </p>
              </div>
            )}
          </article>
        </ReportSection>
      </div>
    </>
  );
}

/** 선 그래프 크기(viewBox). 가로는 칸 너비에 맞춰 늘고(선 굵기는 그대로), 세로는 고정 */
const W = 300;
const H = 104;
const PX = 14;
const PY = 14;

/**
 * 가까운 시장 지표의 한 주(회색 칸 안): 남색 선 + 옅은 면 + 끝 점, 아래 날짜 글자. 소식이 나온 날은 그 소식의 판정 색 점으로.
 * 값은 끝점만 글자로(나머지는 말로 읽는 설명)
 */
function MetricChart({ chart }: { chart: ImpactChart }) {
  const vals = chart.points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || Math.abs(max) * 0.01 || 1;
  const lo = min - span * 0.2;
  const hi = max + span * 0.3;
  const n = vals.length;
  const x = (i: number) => (n === 1 ? W / 2 : PX + (i * (W - PX * 2)) / (n - 1));
  const y = (v: number) => PY + (1 - (v - lo) / (hi - lo)) * (H - PY * 2);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${x(n - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const left = (i: number) => `${(x(i) / W) * 100}%`;
  return (
    <figure className="mt-[18px] rounded-2xl bg-snow p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-sub">{`${chart.name}, 지난주`}</span>
        <span className="whitespace-nowrap">
          <span className="text-[22px] font-extrabold tracking-[-0.03em] tabular-nums">{chart.last}</span>{" "}
          <span className={`text-[14px] font-extrabold tabular-nums ${DIR_COLOR[chart.dir]}`}>{chart.change}</span>
        </span>
      </figcaption>
      <div role="img" aria-label={chart.spoken} className="relative mt-2.5 h-[128px]">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[104px] w-full" aria-hidden="true">
          <path d={area} fill="var(--color-ink)" fillOpacity="0.07" />
          <path d={`M0 ${H - 0.5} H${W}`} stroke="var(--color-line-dark)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={line} fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {chart.marks.map((m) => (
          <span
            key={`${m.index}-${m.title}`}
            title={`${chart.points[m.index]?.label ?? ""}: ${m.title}`}
            aria-hidden="true"
            className={`absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[2.5px] ring-snow ${VERDICT_DOT[m.tone]}`}
            style={{ left: left(m.index), top: y(vals[m.index]!) }}
          />
        ))}
        <span aria-hidden="true" className="absolute size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-snow" style={{ left: left(n - 1), top: y(vals[n - 1]!) }} />
        {chart.points.map((p, i) => (
          <span key={`${p.label}-${i}`} aria-hidden="true" className="absolute top-[110px] -translate-x-1/2 whitespace-nowrap text-[12px] font-semibold text-sub" style={{ left: left(i) }}>
            {p.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
