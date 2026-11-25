import { dayName, busiestDay, REPORT_TONES, type ReportCounts, type ReportDay, type ReportPeriod, type ReportTone } from "@maengo/core/report";
import { ToneIcon } from "@/components/ui/ToneIcon";

// 주간 리포트 화면이 같이 쓰는 조각(2026-11-26 개편: 우선순위 구성 — 지난주 한 줄과 관심사별 판정 → 관심사별로 자세히 → 이번 주 챙겨 볼 일정
// → 지난주 시장 → 놓친 주요 소식 → 나의 한 주 → 자주 나온 키워드). Premium 본문(ReportBody)·Free(ReportFree)·클라이언트 칸(ReportImpact)이 가져다 쓴다.
// 서버·클라이언트 어디서든 쓰도록 상태·"use client" 없이 모양만 둔다.

/** 판정 이름: 알약에는 짧게, 자세히 칸에는 '요인·변수'까지 */
export const VERDICT_SHORT: Record<ReportTone, string> = { minus: "부담", plus: "긍정", watch: "지켜볼" };
export const VERDICT_LONG: Record<ReportTone, string> = { minus: "부담 요인", plus: "긍정 요인", watch: "지켜볼 변수" };
export const VERDICT_CHIP: Record<ReportTone, string> = { minus: "bg-minus-tint text-minus", plus: "bg-plus-tint text-plus", watch: "bg-watch-tint text-watch" };
/** 소식 앞 점 색(판정 색) */
export const VERDICT_DOT: Record<ReportTone, string> = { minus: "bg-minus-mark", plus: "bg-plus-mark", watch: "bg-watch" };

/**
 * 관심사 하나의 판정: 그 관심사에 닿은 소식을 쪽마다 센 것 중 많은 쪽, 같으면 지켜볼 변수.
 * 하나도 못 셌으면(쪽이 비면) 정리한 쪽(fallback)
 */
export function verdictOf(counts: Record<ReportTone, number>, fallback: ReportTone): ReportTone {
  const top = Math.max(counts.minus, counts.plus, counts.watch);
  if (top === 0) return fallback;
  const lead = REPORT_TONES.filter((t) => counts[t] === top);
  return lead.length === 1 ? lead[0]! : "watch";
}

/**
 * 남색 상자 안 판정 알약은 다크에서도 흰 바탕이라 글자색을 밝은 모드 판단 색 hex로 고정한다(--color-plus·minus·watch의 밝은 값과 같다.
 * 토큰을 쓰면 다크에서 연한 값이 흰 바탕 위에 올라 안 읽힌다)
 */
const VERDICT_PILL: Record<ReportTone, string> = { minus: "text-[#E8650A]", plus: "text-[#2563EB]", watch: "text-[#D7323C]" };

/** 남색 상자 안 판정 알약(흰 바탕, 아이콘 + 짧은 이름) */
export function VerdictPill({ tone }: { tone: ReportTone }) {
  return (
    <span className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-white px-2.5 text-[13px] font-extrabold ${VERDICT_PILL[tone]}`}>
      <ToneIcon tone={tone} className="size-[13px]" />
      {VERDICT_SHORT[tone]}
    </span>
  );
}

/** 섹션: 제목 20px/800 + 바로 아래 답이 되는 한 줄 15px. 안의 목록은 얇은 구분선으로 나눈다 */
export function ReportSection({ id, title, lead, children }: { id: string; title: string; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-[20px] font-extrabold tracking-[-0.04em]">
        {title}
      </h2>
      {lead && <p className="mt-1.5 text-[15px] font-medium leading-[1.55] text-ink/80 text-pretty">{lead}</p>}
      {children}
    </section>
  );
}

/**
 * 맨 위 남색 상자(2026-11-26 사용자: 연노랑 다 제거 → 화면의 결론 카드는 남색, 오늘 화면 남색 흐름 카드와 같은 쓰임): 작은 이름표 '지난주 한 줄'(망고 노랑) + 총평 23px/800(흰색),
 * 그 아래 children(관심사별 판정 줄·판정 개수·맞춤 체크 문장). 다크에서도 같은 남색이라 안쪽 글자는 흰색·구분선은 white/12로 직접 적고(토큰이 다크에서 뒤집힌다),
 * 눈에 보이는 포커스 링도 남색 위에서 보이게 망고 노랑으로 바꾼다. children이 줄 목록이면 마지막 줄 아래 여백이 있어 pb를 줄인다(lines)
 */
export function VerdictFrame({ headline, lines = false, children }: { headline: string; lines?: boolean; children?: React.ReactNode }) {
  return (
    <section aria-labelledby="report-sum" className={`rounded-3xl bg-[#1F2340] px-5 pt-[22px] text-white [--color-focus:#FFC23D] ${lines ? "pb-2" : "pb-5"}`}>
      <p className="text-[13px] font-extrabold text-mango">지난주 한 줄</p>
      <h2 id="report-sum" className="mt-2 text-[23px] font-extrabold leading-[1.4] tracking-[-0.045em] text-balance">
        {headline}
      </h2>
      {children}
    </section>
  );
}

/** Free: 판정 줄은 Premium이라 관심사에 닿은 소식을 쪽마다 센 알약만(총평 아래). 쪽을 나누기 전 리포트(null)는 총평만 */
export function ReportVerdict({ headline, tones }: { headline: string; tones?: Record<ReportTone, number> | null }) {
  const shown = tones ? REPORT_TONES.filter((t) => tones[t] > 0) : [];
  return (
    <VerdictFrame headline={headline}>
      {shown.length > 0 && (
        <ul aria-label="내 관심사에 닿은 소식" className="mt-4 flex flex-wrap gap-1.5">
          {shown.map((t) => (
            <li key={t} aria-label={`${VERDICT_LONG[t]} ${tones![t]}개`} className={`inline-flex h-7 items-center gap-1 rounded-full bg-white px-2.5 text-[13px] font-extrabold tabular-nums ${VERDICT_PILL[t]}`}>
              <ToneIcon tone={t} className="size-[13px]" />
              {`${VERDICT_SHORT[t]} ${tones![t]}개`}
            </li>
          ))}
        </ul>
      )}
    </VerdictFrame>
  );
}

/** 앞 기간 이름(견주는 말에 쓴다) */
const before = (period: ReportPeriod) => (period === "week" ? "지난주" : "");

/** 나의 한 주 섹션 머리 아래 한 줄: 가장 많이 본 요일, 요일을 모르는 리포트(Free·예전 것)는 받은 소식 중 본 수 */
export function weekLead(counts: ReportCounts, days?: ReportDay[]): string {
  if (days) {
    const best = busiestDay(days);
    return best ? `${dayName(best.date)}요일에 가장 많이 봤어요 (${best.consumed}개)` : "지난주엔 본 소식이 없어요";
  }
  return counts.consumed > 0 ? `받은 소식 ${counts.received}개 중 ${counts.consumed}개를 봤어요` : "지난주엔 본 소식이 없어요";
}

/** 막대 자리 높이(px). 가장 많이 본 날이 이 높이를 채운다 */
const DAY_BAR = 56;

interface WeekProps {
  period: ReportPeriod;
  counts: ReportCounts;
  prev: ReportCounts | null;
  days?: ReportDay[];
  openDays?: string[];
  prevOpenDays?: number | null;
}

/**
 * 나의 한 주(2×2 회색 칸 + 요일별 막대). 칸마다 이름·큰 숫자·앞 주와의 차이 알약, 아래 '이번 주'(남색)·'지난주'(회색) 막대(둘 중 큰 값이 100%).
 * 앞 주 기록이 없으면(prev null) 숫자만. Free도 칸은 같이 보고, 요일별 막대는 days가 있을 때만(Premium)
 */
export function ReportWeek({ period, counts, prev, days, openDays, prevOpenDays }: WeekProps) {
  const cells = [
    ["받은 소식", counts.received, prev?.received],
    ["본 소식", counts.consumed, prev?.consumed],
    ["들은 소식", counts.listened, prev?.listened],
    ["북마크", counts.bookmarked, prev?.bookmarked],
  ] as const;
  return (
    <>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        {cells.map(([label, now, last]) => (
          <Stat key={label} label={label} now={now} last={last} period={period} />
        ))}
      </dl>
      {days && <Rhythm days={days} openDays={openDays} prevOpenDays={prevOpenDays} />}
    </>
  );
}

function Stat({ label, now, last, period }: { label: string; now: number; last: number | undefined; period: ReportPeriod }) {
  const diff = last === undefined ? null : now - last;
  const max = Math.max(now, last ?? 0, 1);
  return (
    <div className="rounded-[18px] bg-snow p-4">
      <dt className="text-[13px] font-semibold text-sub">{label}</dt>
      <dd className="mt-1.5 flex items-center justify-between gap-1.5">
        <span className="flex items-baseline gap-0.5">
          <span className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.04em] tabular-nums">{now}</span>
          <span className="text-[14px] font-bold text-sub">개</span>
        </span>
        {diff !== null && (
          <span aria-hidden="true" className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-[9px] text-[12.5px] font-extrabold tracking-normal tabular-nums ${diff > 0 ? "bg-paper text-ink ring-1 ring-line" : "bg-line text-ink/80"}`}>
            {diff === 0 ? "같아요" : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)}`}
          </span>
        )}
      </dd>
      {last !== undefined && (
        <>
          <dd aria-hidden="true" className="mt-3 grid grid-cols-[2.4rem_minmax(0,1fr)_1.5rem] items-center gap-x-1.5 gap-y-1.5 text-[12px] tabular-nums">
            <span className="font-bold">이번 주</span>
            <span className="block h-2">
              <span className="block h-2 rounded-full bg-ink" style={{ width: `${(now / max) * 100}%` }} />
            </span>
            <span className="text-right font-extrabold">{now}</span>
            <span className="font-semibold text-sub">{before(period)}</span>
            <span className="block h-2">
              <span className="block h-2 rounded-full bg-line-dark" style={{ width: `${(last / max) * 100}%` }} />
            </span>
            <span className="text-right font-semibold text-sub">{last}</span>
          </dd>
          <dd className="sr-only">{diff === 0 ? `${before(period)} ${last}개와 같아요` : `${before(period)}보다 ${Math.abs(diff!)}개 ${diff! > 0 ? "많아요" : "적어요"}`}</dd>
        </>
      )}
    </div>
  );
}

/**
 * 요일별 막대: 그날 본(읽거나 들은) 소식 수. 가장 많이 본 날만 주황에 숫자를 붙인다(나머지는 회색, 아래 표로 읽는다).
 * 앱을 연 날 수는 한 줄 글로(2026-11-26: 점은 시안에 없어 글로 옮겼다)
 */
function Rhythm({ days, openDays, prevOpenDays }: { days: ReportDay[]; openDays?: string[]; prevOpenDays?: number | null }) {
  const best = busiestDay(days);
  const max = Math.max(1, ...days.map((d) => d.consumed));
  const known = openDays !== undefined;
  const opened = new Set(openDays ?? []);
  return (
    <>
      <div aria-hidden="true" className="mt-4 flex h-[92px] items-end gap-2 px-1">
        {days.map((d) => {
          const on = best?.date === d.date;
          return (
            <span key={d.date} title={`${dayName(d.date)}요일: 받은 ${d.received}개 중 ${d.consumed}개 봄`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              {on && <span className="text-[12px] font-extrabold leading-none tabular-nums">{`${d.consumed}개`}</span>}
              <span className={`block w-full rounded-t ${on ? "bg-mango" : "bg-line-dark"}`} style={{ height: d.consumed ? Math.max(4, Math.round((d.consumed / max) * DAY_BAR)) : 2 }} />
              <span className={`text-[12px] ${on ? "font-extrabold text-ink" : "font-semibold text-sub"}`}>{dayName(d.date)}</span>
            </span>
          );
        })}
      </div>
      {known && <p className="mt-3 text-[13px] font-medium text-sub tabular-nums">{`앱을 연 날 ${opened.size}일${prevOpenDays !== null && prevOpenDays !== undefined ? `, 지난주 ${prevOpenDays}일` : ""}`}</p>}
      <table className="sr-only">
        <caption>요일별로 받은 소식과 본 소식</caption>
        <thead>
          <tr>
            <th scope="col">요일</th>
            <th scope="col">받은 소식</th>
            <th scope="col">본 소식</th>
            {known && <th scope="col">앱을 엶</th>}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayName(d.date)}</th>
              <td>{d.received}</td>
              <td>{d.consumed}</td>
              {known && <td>{opened.has(d.date) ? "예" : "아니요"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
