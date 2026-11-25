"use client";

import Link from "next/link";
import { useState } from "react";
import { IconChevronRight } from "@/components/icons";
import { ToneIcon } from "@/components/ui/ToneIcon";

// 내 관심사에 준 영향(2026-11-25 사용자: 지난주 받은 소식이 내가 관심 있던 것에 어떤 영향이었는지 사용자 관점으로, 숫자는 차트로).
// 위: 관심사마다 부담 요인(왼쪽)·긍정 요인(오른쪽) 소식 수를 가운데 선에서 벌어지는 막대로(지켜볼 변수는 가운데 회색이 아니라 글자로만 —
// 앱의 지켜볼 변수 색이 빨강이라 막대에 넣으면 두 색이 다투고, 쪽을 가르는 막대에는 양쪽 두 색만 둔다(dataviz 규칙)).
// 줄을 누르면 아래 칸이 그 관심사로 바뀐다: 제목·풀이, 가까운 시장 지표의 한 주 선 그래프(소식이 나온 날을 점으로), 흐름을 바꾼 소식, 다음 주 볼 것.
// 값은 서버가 다 계산해서 넘긴다(ReportBody.impactViews). 막대 색은 dataviz 검사를 통과한 plus-mark·minus-mark(globals.css).

export type ImpactTone = "plus" | "minus" | "watch";

export interface ImpactChart {
  name: string;
  last: string;
  change: string;
  /** 한 주 거래일(요일 이름과 값) */
  points: { label: string; value: number }[];
  /** 소식이 나온 날(points 자리)과 그 소식의 쪽 */
  marks: { index: number; tone: ImpactTone; title: string }[];
  /** 그래프를 말로(화면 읽기 프로그램) */
  spoken: string;
}

export interface ImpactView {
  about: string;
  tone: ImpactTone;
  title: string;
  text: string;
  next?: string;
  counts: Record<ImpactTone, number>;
  news: { href: string; title: string; day: string | null; tone: ImpactTone | null }[];
  chart: ImpactChart | null;
}

const TONE_NAME: Record<ImpactTone, string> = { plus: "긍정 요인", minus: "부담 요인", watch: "지켜볼 변수" };
const CHIP: Record<ImpactTone, string> = { plus: "bg-plus-tint text-plus", minus: "bg-minus-tint text-minus", watch: "bg-watch-tint text-watch" };
const MARK: Record<ImpactTone, string> = { plus: "bg-plus-mark", minus: "bg-minus-mark", watch: "bg-watch" };

export function ReportImpact({ interests }: { interests: ImpactView[] }) {
  const [at, setAt] = useState(0);
  const cur = interests[Math.min(at, interests.length - 1)];
  if (!cur) return null;
  const maxSide = Math.max(1, ...interests.map((x) => Math.max(x.counts.plus, x.counts.minus)));
  const width = (n: number) => `${(n / maxSide) * 100}%`;
  return (
    <section aria-labelledby="report-impact">
      <h2 id="report-impact" className="text-[20px] font-bold tracking-[-0.02em]">
        내 관심사에 준 영향
      </h2>
      <p className="mt-1 text-[14px] font-medium leading-relaxed text-sub">지난주 소식이 관심사마다 어느 쪽으로 기울었는지 셌어요. 누르면 자세히 보여요.</p>

      <div className="tile mt-3 px-2.5 pb-2 pt-3.5 sm:px-3">
        <p aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 px-2 text-[12px] font-bold text-sub">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[3px] bg-minus-mark" />
            부담 요인
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[3px] bg-plus-mark" />
            긍정 요인
          </span>
        </p>
        <div className="relative mt-2">
          <span aria-hidden="true" className="absolute inset-y-3 left-1/2 w-px bg-line-dark" />
          {interests.map((x, i) => {
            const on = i === at;
            return (
              <button
                key={`${x.about}-${i}`}
                type="button"
                aria-pressed={on}
                onClick={() => setAt(i)}
                className={`relative block w-full rounded-xl px-2 pb-3 pt-2.5 text-left transition-colors ${on ? "bg-snow" : "hover:bg-snow/60"}`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.01em]">{x.about}</span>
                  <span className="shrink-0 text-[12px] font-semibold text-sub tabular-nums">
                    {`부담 ${x.counts.minus}, 긍정 ${x.counts.plus}`}
                    {x.counts.watch > 0 && `, 지켜볼 ${x.counts.watch}`}
                  </span>
                </span>
                <span aria-hidden="true" className={`mt-2 grid grid-cols-2 transition-opacity ${on ? "" : "opacity-55"}`}>
                  <span className="flex justify-end pr-px">
                    <span className="block h-5 rounded-l-[4px] bg-minus-mark" style={{ width: width(x.counts.minus) }} />
                  </span>
                  <span className="flex pl-px">
                    <span className="block h-5 rounded-r-[4px] bg-plus-mark" style={{ width: width(x.counts.plus) }} />
                  </span>
                </span>
                <span className="sr-only">{`: 부담 요인 ${x.counts.minus}개, 긍정 요인 ${x.counts.plus}개, 지켜볼 변수 ${x.counts.watch}개`}</span>
              </button>
            );
          })}
        </div>
      </div>

      <article aria-live="polite" className="tile mt-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${CHIP[cur.tone]}`}>
            <ToneIcon tone={cur.tone} />
            {TONE_NAME[cur.tone]}
          </span>
          <span className="min-w-0 truncate text-[14px] font-bold">{cur.about}</span>
        </div>
        <h3 className="mt-2.5 text-[19px] font-bold leading-snug tracking-[-0.03em] text-balance">{cur.title}</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-sub">{cur.text}</p>

        {cur.chart && <MetricChart chart={cur.chart} />}

        {cur.news.length > 0 && (
          <>
            <h4 className="mt-5 text-[13px] font-bold text-sub">흐름을 바꾼 소식</h4>
            <ul className="mt-1">
              {cur.news.map((n) => (
                <li key={n.href} className="border-t border-line first:border-t-0">
                  <Link href={n.href} className="grid grid-cols-[1.75rem_0.75rem_minmax(0,1fr)_1rem] items-start gap-1.5 py-3 no-underline hover:text-mango-deep">
                    <span className="text-[13px] font-bold">{n.day ?? ""}</span>
                    <span aria-hidden="true" className={`mt-1.5 size-2 rounded-full ${n.tone ? MARK[n.tone] : "bg-line-dark"}`} />
                    <span className="text-[15px] font-semibold leading-snug">
                      {n.title}
                      {n.tone && <span className="sr-only">{`, ${TONE_NAME[n.tone]}`}</span>}
                    </span>
                    <IconChevronRight className="mt-0.5 size-4 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {cur.next && (
          <p className="mt-3 flex gap-2.5 rounded-xl bg-mango-tint px-3.5 py-3 text-[14px] font-semibold leading-relaxed">
            <span className="shrink-0 font-bold">다음 주</span>
            <span>{cur.next}</span>
          </p>
        )}
      </article>
    </section>
  );
}

/** 선 그래프 크기(viewBox). 가로는 칸 너비에 맞춰 늘고(선 굵기는 그대로), 세로는 고정 */
const W = 300;
const H = 120;
const PX = 14;
const PY = 18;

/** 가까운 시장 지표의 한 주. 소식이 나온 날을 그 소식의 쪽 색 점으로. 값은 끝점만 글자로(나머지는 말로 읽는 설명) */
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
  const line = `M${vals.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" L")}`;
  const area = `${line} L${x(n - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
  const left = (i: number) => `${(x(i) / W) * 100}%`;
  return (
    <figure className="mt-4 rounded-2xl bg-snow px-3.5 pb-2 pt-3 text-ink">
      <figcaption className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-sub">{`${chart.name}, 지난주`}</span>
        <span className="text-[17px] font-bold">{chart.last}</span>
        <span className="text-[13px] font-bold tabular-nums">{chart.change}</span>
      </figcaption>
      <div role="img" aria-label={chart.spoken} className="relative mt-2 h-[138px]">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-[120px] w-full" aria-hidden="true">
          <path d={`M0 ${H - 0.5} H${W}`} stroke="var(--color-line-dark)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={area} fill="currentColor" opacity="0.07" />
          <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {chart.marks.map((m) => (
          <span
            key={`${m.index}-${m.title}`}
            title={`${chart.points[m.index]?.label ?? ""}: ${m.title}`}
            aria-hidden="true"
            className={`absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-snow ${MARK[m.tone]}`}
            style={{ left: left(m.index), top: y(vals[m.index]!) }}
          />
        ))}
        <span aria-hidden="true" className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-snow" style={{ left: left(n - 1), top: y(vals[n - 1]!) }} />
        {chart.points.map((p, i) => (
          <span key={`${p.label}-${i}`} aria-hidden="true" className="absolute top-[122px] -translate-x-1/2 text-[11px] font-semibold text-sub" style={{ left: left(i) }}>
            {p.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
