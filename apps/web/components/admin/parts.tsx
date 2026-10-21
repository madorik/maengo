import Link from "next/link";
import { ADMIN_TABS, type AdminRange, type AdminTab, adminHref, adminPresets } from "@/lib/admin-range";
import { type FunnelStep, type RetentionRow, ratio, retentionTotal } from "@/lib/admin-stats";
import { withBase } from "@/lib/base-path";

// 관리자 화면(app/admin/page.tsx) 조각. 서버에서만 그린다.

export const num = (n: number) => n.toLocaleString("ko-KR");
export const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
/** 'YYYY-MM-DD' → 'MM/DD' */
export const md = (date: string) => date.slice(5).replace("-", "/");

/** 구역(가입·온보딩, 활동 …). 제목 아래 칸들을 쌓는다 */
export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="pt-2 text-[17px] font-black tracking-[-0.01em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="tile p-4">
      <h3 className="text-[13px] font-extrabold text-sub">{label}</h3>
      <p className="mt-1 font-round text-[30px] font-black leading-none tabular-nums">{value}</p>
      <p className="mt-2 truncate text-[12px] font-semibold text-faint" title={sub}>
        {sub}
      </p>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tile p-4">
      <h3 className="mb-3 text-[15px] font-black">{title}</h3>
      {children}
    </div>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3 py-1 text-[14px]">
      <span className="font-semibold text-sub">{label}</span>
      <span className="text-right font-extrabold tabular-nums">{value}</span>
    </p>
  );
}

/** 카드 아래 한 줄 설명(무엇을 셌는지) */
export function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[12px] font-semibold text-faint">{children}</p>;
}

export function Chips({ data, labels }: { data: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(data);
  if (!entries.length) return <p className="mt-1 text-[13px] font-semibold text-faint">없음</p>;
  return (
    <p className="mt-1 flex flex-wrap gap-1.5">
      {entries.map(([k, n]) => (
        <span key={k} className="rounded-lg bg-snow px-2 py-1 text-[13px] font-bold">
          {labels[k] ?? k} <span className="font-round font-black">{n}</span>
        </span>
      ))}
    </p>
  );
}

/** 탭(가입·활동 / 매출·콘텐츠 / 운영). 탭마다 그 탭의 숫자만 DB에서 센다. 기간은 그대로 넘긴다 */
export function Tabs({ tab, range }: { tab: AdminTab; range: AdminRange }) {
  return (
    <nav aria-label="관리자 탭" className="-mb-[2px] flex gap-1 overflow-x-auto">
      {ADMIN_TABS.map((t) => {
        const on = t.id === tab;
        return (
          <Link
            key={t.id}
            href={adminHref(t.id, range)}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center border-b-[3px] px-3 text-[15px] font-extrabold ${on ? "border-ink text-ink" : "border-transparent text-sub hover:text-ink"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 빠른 기간 + 날짜 두 칸. 폼은 GET이라 주소(?tab=&from=&to=)만 바뀐다. 보던 탭은 그대로 */
export function RangeBar({ tab, range, today }: { tab: AdminTab; range: AdminRange; today: string }) {
  return (
    <section className="flex flex-wrap items-center gap-2" aria-label="기간">
      <nav className="flex flex-wrap gap-1.5" aria-label="빠른 기간">
        {adminPresets(today).map((p) => {
          const on = p.from === range.from && p.to === range.to;
          return (
            <Link
              key={p.label}
              href={adminHref(tab, p)}
              aria-current={on ? "true" : undefined}
              className={`flex min-h-11 items-center rounded-xl border-2 px-3 text-[14px] font-extrabold ${on ? "border-ink bg-ink text-paper" : "border-line bg-paper text-sub hover:text-ink"}`}
            >
              {p.label}
            </Link>
          );
        })}
      </nav>
      {/* 빠른 기간을 눌러도 칸이 새 값으로 바뀌게 기간이 바뀌면 다시 그린다 */}
      {/* 좁은 화면에선 날짜 두 칸이 한 줄을 다 쓰고 보기 버튼은 아래 줄로, 아주 좁으면(360px 미만) 날짜도 한 줄에 하나 */}
      <form key={`${range.from}~${range.to}`} action={withBase("/admin")} className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 max-[359px]:grid-cols-1 sm:ml-auto sm:flex sm:w-auto">
        {tab !== "growth" && <input type="hidden" name="tab" value={tab} />}
        <label htmlFor="range-from" className="sr-only">
          시작일
        </label>
        <input id="range-from" type="date" name="from" defaultValue={range.from} max={today} required className="tile min-h-11 min-w-0 px-2.5 text-[16px] font-bold tabular-nums sm:px-3" />
        <span aria-hidden="true" className="font-bold text-faint max-[359px]:hidden">
          ~
        </span>
        <label htmlFor="range-to" className="sr-only">
          종료일
        </label>
        <input id="range-to" type="date" name="to" defaultValue={range.to} max={today} required className="tile min-h-11 min-w-0 px-2.5 text-[16px] font-bold tabular-nums sm:px-3" />
        <button type="submit" className="btn btn-ink col-span-full min-h-11 shrink-0 px-4 text-[14px]">
          보기
        </button>
      </form>
    </section>
  );
}

/** 선 색. 같은 화면에 나란히 놓인 가입·온보딩처럼 다른 숫자는 다른 색으로 */
const TONES = {
  sky: { area: "fill-sky-tint", line: "stroke-sky", dot: "bg-sky" },
  leaf: { area: "fill-leaf-tint", line: "stroke-leaf", dot: "bg-leaf" },
  mango: { area: "fill-mango-tint", line: "stroke-mango-dark", dot: "bg-mango-dark" },
} as const;

/** 기간 추이(선 그래프, 오른쪽 끝이 마지막 날). 날짜 위에 마우스를 올리면 그날 값이 보인다 */
export function Trend({
  title,
  caption,
  value,
  unit = "",
  tone = "sky",
  scaleMax,
  data,
  range,
  today,
}: {
  title: string;
  caption: string;
  value: string;
  /** 값 뒤에 붙일 단위(예: %) */
  unit?: string;
  tone?: keyof typeof TONES;
  /** 나란히 놓인 그래프끼리 같은 눈금으로 비교하게 세로 최댓값을 맞춘다 */
  scaleMax?: number;
  data: { date: string; v: number }[];
  range: AdminRange;
  today: string;
}) {
  const W = 300;
  const H = 100;
  const PAD = 8;
  const t = TONES[tone];
  const peak = Math.max(0, ...data.map((d) => d.v));
  const max = Math.max(1, scaleMax ?? 0, peak);
  const step = data.length > 1 ? W / (data.length - 1) : W;
  const x = (i: number) => (data.length > 1 ? i * step : W / 2);
  const y = (v: number) => PAD + (1 - v / max) * (H - PAD * 2);
  const line = `M${data.map((d, i) => `${x(i).toFixed(1)},${y(d.v).toFixed(1)}`).join(" L")}`;
  const base = y(0);
  const area = `${line} L${x(data.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;
  const last = data.at(-1);
  return (
    <div className="tile p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-extrabold text-sub">{title}</h3>
        <p className="shrink-0 whitespace-nowrap">
          <span className="mr-1 text-[11px] font-bold text-faint">{caption}</span>
          <span className="font-round text-[20px] font-black tabular-nums">{value}</span>
        </p>
      </div>
      <div className="relative mt-3 h-24">
        {/* 가로로 늘려 그리고(preserveAspectRatio none) 선 굵기는 그대로 둔다(non-scaling-stroke) */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={`${title}, ${range.from}~${range.to}: ${data.map((d) => `${md(d.date)} ${d.v}${unit}`).join(", ")}`}
        >
          <line x1={0} y1={base} x2={W} y2={base} className="stroke-line" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <path d={area} className={t.area} />
          <path d={line} fill="none" className={t.line} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {data.map((d, i) => (
            <rect key={d.date} x={x(i) - step / 2} y={0} width={step} height={H} fill="transparent">
              <title>{`${d.date} ${d.v}${unit}`}</title>
            </rect>
          ))}
        </svg>
        {last && (
          <span
            aria-hidden="true"
            className={`absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper ${t.dot}`}
            style={{ left: `${(x(data.length - 1) / W) * 100}%`, top: `${(y(last.v) / H) * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-bold text-faint">
        <span>{md(range.from)}</span>
        <span>
          최고 {num(peak)}
          {unit}
        </span>
        <span>{range.to === today ? "오늘" : md(range.to)}</span>
      </div>
    </div>
  );
}

/** 가입 퍼널: 단계마다 가입 대비 막대, 앞 단계 대비 비율. 결제는 단계 밖이라 아래 따로 */
export function Funnel({ steps, paid }: { steps: FunnelStep[]; paid: number }) {
  const signups = steps[0]?.n ?? 0;
  return (
    <>
      <ol className="flex flex-col gap-2.5">
        {steps.map((s) => (
          <li key={s.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-[14px]">
            <span className="leading-tight">
              <span className="block font-bold">{s.label}</span>
              {s.ofPrev !== null && <span className="block text-[12px] font-semibold text-faint">앞 단계의 {pct(s.ofPrev)}</span>}
            </span>
            <span className="h-6 overflow-hidden rounded-lg bg-snow">
              <span className="block h-full rounded-lg bg-mango" style={{ width: `${s.n ? Math.max(2, (s.ofFirst ?? 0) * 100) : 0}%` }} />
            </span>
            <span className="text-right tabular-nums">
              <span className="font-round text-[16px] font-black">{num(s.n)}</span>
              <span className="ml-1 text-[12px] font-bold text-faint">{pct(s.ofFirst)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-line pt-3 text-[14px]">
        <span className="font-bold">결제한 사람</span>
        <span className="tabular-nums">
          <span className="font-round text-[16px] font-black">{num(paid)}</span>
          <span className="ml-1 text-[12px] font-bold text-faint">가입의 {pct(ratio(paid, signups))}</span>
        </span>
      </p>
    </>
  );
}

/** 가입 주별 재방문 표. 칸은 비율이 높을수록 진하다. 모수가 없는 칸(그날이 아직 안 지남)은 — */
export function Retention({ rows }: { rows: RetentionRow[] }) {
  if (!rows.length) return <p className="text-[14px] font-semibold text-faint">기간에 가입한 사람이 없어요</p>;
  const total = retentionTotal(rows);
  const cell = (n: number, base: number) => {
    const r = ratio(n, base);
    return (
      <td
        className="px-1.5 py-2 text-right"
        style={r === null ? undefined : { backgroundColor: `color-mix(in srgb, var(--color-sky) ${Math.round(r * 45)}%, transparent)` }}
      >
        {r === null ? (
          <span className="text-faint">—</span>
        ) : (
          <>
            <span className="font-extrabold">{pct(r)}</span>
            <span className="block text-[11px] font-semibold text-sub">
              {n}/{base}
            </span>
          </>
        )}
      </td>
    );
  };
  return (
    <table className="w-full text-left text-[13px] tabular-nums">
      <thead className="text-sub">
        <tr>
          <th className="pb-2 pr-1.5 font-extrabold">가입 주</th>
          <th className="px-1.5 pb-2 text-right font-extrabold">사람</th>
          <th className="px-1.5 pb-2 text-right font-extrabold">D1</th>
          <th className="px-1.5 pb-2 text-right font-extrabold">D7</th>
          <th className="px-1.5 pb-2 text-right font-extrabold">D30</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.week} className="border-t-2 border-line">
            <td className="whitespace-nowrap py-2 pr-1.5 font-bold">{md(r.week)} 주</td>
            <td className="px-1.5 py-2 text-right font-bold">{num(r.users)}</td>
            {cell(r.d1, r.d1Base)}
            {cell(r.d7, r.d7Base)}
            {cell(r.d30, r.d30Base)}
          </tr>
        ))}
      </tbody>
      {rows.length > 1 && (
        <tfoot>
          <tr className="border-t-2 border-ink/20">
            <td className="py-2 pr-1.5 font-black">합계</td>
            <td className="px-1.5 py-2 text-right font-black">{num(total.users)}</td>
            {cell(total.d1, total.d1Base)}
            {cell(total.d7, total.d7Base)}
            {cell(total.d30, total.d30Base)}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
