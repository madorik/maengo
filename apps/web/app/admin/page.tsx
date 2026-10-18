import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { kstDate } from "@maengo/core/kst";
import { type AdminRange, adminPresets, parseAdminRange, spanDays } from "@/lib/admin-range";
import { isAdmin } from "@/lib/server/admin";
import { adminAlerts } from "@/lib/server/admin-alerts";
import { db, must } from "@/lib/server/db";
import { requireProfile } from "@/lib/server/session";
import { withBase } from "@/lib/base-path";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

// 관리자 통계(TODO.md 1번). 숫자는 DB 함수 admin_stats(supabase/migrations/…_visits_dau_mau.sql) 한 번으로 모은다. 날짜는 한국 시간.
// 기간(?from=&to=, 기본 오늘까지 14일)은 활동·가입·콘텐츠·비용·알림 결과에 걸린다. 회원 수·관심사·작업 상태는 지금 값.
// 활동 = 그날 앱을 열었거나(visits) 읽었거나 들은 사람. DAU는 마지막 날, MAU는 마지막 날까지 30일.
// 개인을 알아볼 수 있는 값(이메일·이름)은 보여 주지 않는다.

const KRW_PER_USD = 1400;
/** Google TTS Chirp 3 HD 매월 무료 글자 수, 넘으면 100만 자당 $30 */
const TTS_FREE_CHARS = 1_000_000;
const PLAN_LABEL: Record<string, string> = { plus: "Premium", free: "Free" };
const TASK_LABEL: Record<string, string> = { deliveries: "소식 지급·알림", ingest: "수집", summarize: "요약", daily: "하루 정리", trial_reminder: "체험 끝 알림" };
const DELIVERY_LABEL: Record<string, string> = {
  pending: "대기",
  building: "만드는 중",
  ready: "보낼 차례",
  sending: "보내는 중",
  sent: "보냄",
  empty: "소식 없음",
  had: "이미 받음",
  no_device: "기기 없음",
  muted: "알림 꺼짐",
  failed: "실패",
};

interface Stats {
  today: string;
  users: { total: number; onboarded: number; signups: number; pushOn: number; plans: Record<string, number> };
  activity: {
    active: number;
    /** 마지막 날(to) 활동한 사람 */
    dau: number;
    /** 마지막 날까지 30일 동안 활동한 사람 */
    mau: number;
    reads: number;
    listens: number;
    fed: number;
    feedback: Record<string, number>;
    feedbackAll: Record<string, number>;
  };
  /** active = 그날 DAU, mau = 그날까지 30일 */
  daily: { date: string; signups: number; active: number; mau: number; reads: number; listens: number }[];
  content: { items: number; summaries: number; summariesTotal: number; topics: { id: string; name: string; custom: boolean; users: number }[] };
  cost: { geminiUsd: number; geminiMonthUsd: number; ttsMonthChars: number; ttsMonthUsd: number; voices: number };
  ops: {
    tasks: {
      name: string;
      enabled: boolean;
      everyMinutes: number;
      nextRunAt: string;
      runningSince: string | null;
      lastFinishedAt: string | null;
      lastStatus: string | null;
      lastError: string | null;
    }[];
    deliveries: Record<string, number>;
    devices: Record<string, number>;
  };
}

type Props = { searchParams: Promise<{ from?: string | string[]; to?: string | string[] }> };

const num = (n: number) => n.toLocaleString("ko-KR");
const won = (usd: number) => `${Math.round(usd * KRW_PER_USD).toLocaleString("ko-KR")}원`;
const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const when = (iso: string | null) => (iso ? kst.format(new Date(iso)) : "—");
/** 'YYYY-MM-DD' → 'MM/DD' */
const md = (date: string) => date.slice(5).replace("-", "/");

export default async function AdminPage({ searchParams }: Props) {
  const profile = await requireProfile();
  if (!isAdmin(profile)) notFound();
  const today = kstDate();
  const range = parseAdminRange(await searchParams, today);
  const [stats, alerts] = await Promise.all([db.rpc("admin_stats", { p_from: range.from, p_to: range.to }), adminAlerts()]);
  const s = must(stats, "admin_stats") as Stats;
  const ttsShare = Math.min(1, s.cost.ttsMonthChars / TTS_FREE_CHARS);
  const ttsBill = (Math.max(0, s.cost.ttsMonthChars - TTS_FREE_CHARS) * 30) / 1e6;
  const fbTotal = (s.activity.feedback.more ?? 0) + (s.activity.feedback.skip ?? 0);
  const topMax = Math.max(1, ...s.content.topics.map((t) => t.users));
  const activeAvg = s.daily.reduce((n, d) => n + d.active, 0) / spanDays(range);
  const activePeak = Math.max(0, ...s.daily.map((d) => d.active));
  // DAU/MAU(고착도): 날마다 그날 DAU ÷ 그날까지 30일 MAU. MAU가 0인 날은 평균에서 뺀다
  const sticky = s.daily.map((d) => ({ date: d.date, v: d.mau ? Math.round((d.active / d.mau) * 100) : 0 }));
  const stickyDays = s.daily.filter((d) => d.mau > 0);
  const stickyAvg = stickyDays.length ? stickyDays.reduce((n, d) => n + d.active / d.mau, 0) / stickyDays.length : null;
  const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
  const endLabel = range.to === today ? "오늘" : md(range.to);
  const trend = { range, today };

  return (
    <div className="min-h-dvh bg-snow">
      <header className="border-b-2 border-line bg-paper">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-[22px] font-black tracking-[-0.02em]">맹고 관리자</h1>
            <p className="text-[13px] font-semibold text-sub">{s.today} 기준(한국 시간), 새로고침하면 다시 센다</p>
          </div>
          <Link href="/today" className="btn btn-ghost min-h-11 px-4 text-[14px]">
            앱으로
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-5 py-6">
        {alerts.map((a) => (
          <div key={a.title} role="alert" className="rounded-2xl border-2 border-orange bg-[#FFF1E6] px-5 py-4 dark:bg-[#3A2414]">
            <p className="text-[16px] font-black text-orange">{a.title}</p>
            <p className="mt-1 text-[14px] font-semibold text-ink">{a.detail}</p>
          </div>
        ))}
        <RangeBar range={range} today={today} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="회원" value={num(s.users.total)} sub={`가입 +${num(s.users.signups)} · 온보딩 ${num(s.users.onboarded)}`} />
          <Stat label="DAU" value={num(s.activity.dau)} sub={`${endLabel} · 최고 ${num(activePeak)}명`} />
          <Stat label="MAU" value={num(s.activity.mau)} sub={`DAU/MAU ${pct(s.activity.mau ? s.activity.dau / s.activity.mau : null)}`} />
          <Stat label="활동한 사람" value={num(s.activity.active)} sub={`읽음 ${num(s.activity.reads)} · 들음 ${num(s.activity.listens)}`} />
          <Stat label="소식 받은 사람" value={num(s.activity.fed)} sub={`알림 보냄 ${num(s.ops.deliveries.sent ?? 0)}`} />
          <Stat label="알림 켬" value={num(s.users.pushOn)} sub={Object.entries(s.users.plans).map(([p, n]) => `${PLAN_LABEL[p] ?? p} ${num(n)}`).join(" · ")} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Trend {...trend} title="DAU" caption="하루 평균" value={activeAvg < 10 ? activeAvg.toFixed(1) : num(Math.round(activeAvg))} data={s.daily.map((d) => ({ date: d.date, v: d.active }))} />
          <Trend {...trend} title="MAU(그날까지 30일)" caption={endLabel} value={num(s.activity.mau)} data={s.daily.map((d) => ({ date: d.date, v: d.mau }))} />
          <Trend {...trend} title="DAU/MAU" caption="평균" value={pct(stickyAvg)} unit="%" data={sticky} />
          <Trend {...trend} title="가입" caption="합계" value={num(s.users.signups)} data={s.daily.map((d) => ({ date: d.date, v: d.signups }))} />
          <Trend {...trend} title="읽음(글을 연 소식)" caption="합계" value={num(s.activity.reads)} data={s.daily.map((d) => ({ date: d.date, v: d.reads }))} />
          <Trend {...trend} title="들음(음성으로 들은 소식)" caption="합계" value={num(s.activity.listens)} data={s.daily.map((d) => ({ date: d.date, v: d.listens }))} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card title="비용(추정)">
            <Row label="Gemini 요약·임베딩" value={`$${s.cost.geminiUsd.toFixed(2)} (${won(s.cost.geminiUsd)})`} />
            <Row label="Gemini 이번 달" value={`$${s.cost.geminiMonthUsd.toFixed(2)}`} />
            <Row label="새로 만든 음성" value={`${num(s.cost.voices)}개`} />
            <p className="mt-3 text-[13px] font-bold text-sub">
              TTS 이번 달 {num(s.cost.ttsMonthChars)}자 / 무료 {num(TTS_FREE_CHARS)}자
            </p>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`TTS 무료 한도의 ${Math.round(ttsShare * 100)}%`}>
              <div className={`h-full rounded-full ${ttsShare > 0.8 ? "bg-orange" : "bg-sky"}`} style={{ width: `${Math.max(1, ttsShare * 100)}%` }} />
            </div>
            <p className="mt-1 text-[12px] font-semibold text-faint">무료 한도를 넘으면 100만 자당 $30. 지금 청구 예상 ${ttsBill.toFixed(2)}</p>
          </Card>
          <Card title="콘텐츠">
            <Row label="새로 모은 글" value={num(s.content.items)} />
            <Row label="요약" value={num(s.content.summaries)} />
            <Row label="요약 전체" value={num(s.content.summariesTotal)} />
          </Card>
          <Card title="좋아요·싫어요">
            <Row label="좋아요" value={`${num(s.activity.feedback.more ?? 0)} (전체 ${num(s.activity.feedbackAll.more ?? 0)})`} />
            <Row label="싫어요" value={`${num(s.activity.feedback.skip ?? 0)} (전체 ${num(s.activity.feedbackAll.skip ?? 0)})`} />
            <Row label="좋아요 비율" value={fbTotal ? `${Math.round(((s.activity.feedback.more ?? 0) / fbTotal) * 100)}%` : "—"} />
          </Card>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="관심사(고른 사람 수)">
            {s.content.topics.length === 0 ? (
              <p className="text-[14px] font-semibold text-faint">아직 없어요</p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {s.content.topics.map((t) => (
                  <li key={t.id} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2 text-[14px]">
                    <span className="truncate font-bold">
                      {t.name}
                      {t.custom && <span className="ml-1 text-[12px] font-semibold text-faint">기타</span>}
                    </span>
                    <span className="h-2 rounded-full bg-line">
                      <span className="block h-full rounded-full bg-mango" style={{ width: `${(t.users / topMax) * 100}%` }} />
                    </span>
                    <span className="text-right font-round font-black tabular-nums">{t.users}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="운영">
            <table className="w-full text-left text-[13px]">
              <thead className="text-sub">
                <tr>
                  <th className="whitespace-nowrap pb-2 pr-3 font-extrabold">작업</th>
                  <th className="whitespace-nowrap pb-2 pr-3 font-extrabold">다음 차례</th>
                  <th className="pb-2 font-extrabold">마지막</th>
                </tr>
              </thead>
              <tbody>
                {s.ops.tasks.map((t) => (
                  <tr key={t.name} className="border-t-2 border-line align-top">
                    <td className="whitespace-nowrap py-2 pr-3 font-bold">
                      {TASK_LABEL[t.name] ?? t.name}
                      <span className="block text-[12px] font-semibold text-faint">{t.everyMinutes >= 1440 ? "하루" : `${t.everyMinutes}분`}마다{t.enabled ? "" : " · 꺼짐"}</span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{t.runningSince ? "도는 중" : when(t.nextRunAt)}</td>
                    <td className="py-2">
                      <span className={`font-extrabold ${t.lastStatus === "failed" ? "text-orange" : t.lastStatus === "ok" ? "text-leaf" : "text-faint"}`}>
                        {t.lastStatus === "ok" ? "성공" : t.lastStatus === "failed" ? "실패" : "—"}
                      </span>
                      <span className="ml-1 tabular-nums text-sub">{when(t.lastFinishedAt)}</span>
                      {t.lastError && <span className="mt-0.5 block line-clamp-2 break-all text-[12px] text-faint">{t.lastError}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-[13px] font-extrabold text-sub">알림 결과</p>
            <Chips data={s.ops.deliveries} labels={DELIVERY_LABEL} />
            <p className="mt-3 text-[13px] font-extrabold text-sub">알림 기기</p>
            <Chips data={s.ops.devices} labels={{ web: "웹", ios: "iOS", android: "Android" }} />
          </Card>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <section className="tile p-4">
      <h2 className="text-[13px] font-extrabold text-sub">{label}</h2>
      <p className="mt-1 font-round text-[30px] font-black leading-none tabular-nums">{value}</p>
      <p className="mt-2 truncate text-[12px] font-semibold text-faint">{sub}</p>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="tile p-4">
      <h2 className="mb-3 text-[15px] font-black">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3 py-1 text-[14px]">
      <span className="font-semibold text-sub">{label}</span>
      <span className="font-extrabold tabular-nums">{value}</span>
    </p>
  );
}

/** 빠른 기간 + 날짜 두 칸. 폼은 GET이라 주소(?from=&to=)만 바뀐다 */
function RangeBar({ range, today }: { range: AdminRange; today: string }) {
  return (
    <section className="flex flex-wrap items-center gap-2" aria-label="기간">
      <nav className="flex flex-wrap gap-1.5" aria-label="빠른 기간">
        {adminPresets(today).map((p) => {
          const on = p.from === range.from && p.to === range.to;
          return (
            <Link
              key={p.label}
              href={`/admin?from=${p.from}&to=${p.to}`}
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

/** 기간 추이(선 그래프, 오른쪽 끝이 마지막 날). 날짜 위에 마우스를 올리면 그날 값이 보인다 */
function Trend({
  title,
  caption,
  value,
  unit = "",
  data,
  range,
  today,
}: {
  title: string;
  caption: string;
  value: string;
  /** 값 뒤에 붙일 단위(예: %) */
  unit?: string;
  data: { date: string; v: number }[];
  range: AdminRange;
  today: string;
}) {
  const W = 300;
  const H = 100;
  const PAD = 8;
  const max = Math.max(1, ...data.map((d) => d.v));
  const step = data.length > 1 ? W / (data.length - 1) : W;
  const x = (i: number) => (data.length > 1 ? i * step : W / 2);
  const y = (v: number) => PAD + (1 - v / max) * (H - PAD * 2);
  const line = `M${data.map((d, i) => `${x(i).toFixed(1)},${y(d.v).toFixed(1)}`).join(" L")}`;
  const base = y(0);
  const area = `${line} L${x(data.length - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;
  const last = data.at(-1);
  return (
    <section className="tile p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-extrabold text-sub">{title}</h2>
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
          <path d={area} className="fill-sky-tint" />
          <path d={line} fill="none" className="stroke-sky" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {data.map((d, i) => (
            <rect key={d.date} x={x(i) - step / 2} y={0} width={step} height={H} fill="transparent">
              <title>{`${d.date} ${d.v}${unit}`}</title>
            </rect>
          ))}
        </svg>
        {last && (
          <span
            aria-hidden="true"
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-sky"
            style={{ left: `${(x(data.length - 1) / W) * 100}%`, top: `${(y(last.v) / H) * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-bold text-faint">
        <span>{md(range.from)}</span>
        <span>
          최고 {num(max)}
          {unit}
        </span>
        <span>{range.to === today ? "오늘" : md(range.to)}</span>
      </div>
    </section>
  );
}

function Chips({ data, labels }: { data: Record<string, number>; labels: Record<string, string> }) {
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
