import { type AdminRange, TREND_MIN_DAYS, trendRange } from "@/lib/admin-range";
import { KRW_PER_USD, type SummaryDay, type SummaryStats, summarySeries, summaryTotals } from "@/lib/admin-stats";
import { db, must } from "@/lib/server/db";
import { Note, Section, Stat, Trend, md, num, pct, won } from "./parts";

// 관리자 요약 탭(처음 여는 탭, 2026-11-08). 숫자는 admin_stats_summary(supabase/migrations/20261108120000_admin_summary.sql).
// 위 칸은 고른 기간(기본 오늘), 아래 추이는 기간이 짧아도 끝날까지 TREND_MIN_DAYS일을 그린다(하루짜리 추이는 점 하나라).
// 가입 전환율 = 가입 ÷ 로그인 안 한 방문자(app/api/visit). 방문자를 센 날(firstVisit)부터만 나눈다.

export async function SummaryTab({ range, today }: { range: AdminRange; today: string }) {
  const chartRange = trendRange(range);
  const s = must(await db.rpc("admin_stats_summary", { p_from: chartRange.from, p_to: chartRange.to }), "admin_stats_summary") as SummaryStats;
  const days = summarySeries(s);
  const t = summaryTotals(days, range, s.firstVisit);

  const trend = { range: chartRange, today };
  const series = (k: keyof Omit<SummaryDay, "date">) => days.map((d) => ({ date: d.date, v: d[k] }));
  const windowSum = (k: "visitors" | "signups" | "newSubs" | "revenue" | "cost") => days.reduce((n, d) => n + d[k], 0);
  const endLabel = chartRange.to === today ? "오늘" : md(chartRange.to);
  const last = days.at(-1);
  // 전환율·방문자 그래프는 방문자를 센 날부터(그 전은 0이 아니라 모르는 값)
  const visitFrom = s.firstVisit && s.firstVisit > chartRange.from ? s.firstVisit : chartRange.from;
  const visitDays = s.firstVisit ? days.filter((d) => d.date >= visitFrom) : [];
  const visitTrend = { range: { from: visitFrom, to: chartRange.to }, today };
  const visitSum = visitDays.reduce((n, d) => n + d.visitors, 0);
  const visitSignups = visitDays.reduce((n, d) => n + d.signups, 0);
  const rangeLabel = range.from === range.to ? (range.to === today ? "오늘" : range.to) : `${range.from} ~ ${range.to === today ? "오늘" : range.to}`;

  return (
    <>
      <Section id="sec-summary" title={`요약 · ${rangeLabel}`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-1">
            <Stat
              label="가입 전환율"
              value={pct(t.conversion)}
              sub={s.firstVisit ? `방문 ${num(t.visitors)} → 가입 ${num(t.trackedSignups)}` : "방문자 집계 전"}
            />
          </div>
          <Stat label="신규 가입" value={num(t.signups)} sub={`전체 회원 ${num(t.users)}`} />
          <Stat label="신규 구독" value={num(t.newSubs)} sub={`전체 구독자 ${num(t.subs)}${t.trials ? ` · 체험 시작 ${num(t.trials)}` : ""}`} />
          <Stat label="매출" value={won(t.revenue)} sub={`전체 ${won(t.revenueTotal)}`} />
          <Stat label="지출(API)" value={won(t.cost)} sub={`전체 ${won(t.costTotal)}`} />
        </div>
      </Section>

      <Section id="sec-summary-trend" title={`추이 · ${md(chartRange.from)} ~ ${endLabel}`}>
        <div className="grid gap-3 md:grid-cols-2">
          {visitDays.length ? (
            <>
              <Trend
                {...visitTrend}
                title="가입 전환율(일)"
                caption="평균"
                value={pct(visitSum ? visitSignups / visitSum : null)}
                unit="%"
                data={visitDays.map((d) => ({ date: d.date, v: d.visitors ? Math.round((d.signups / d.visitors) * 100) : 0 }))}
              />
              <Trend {...visitTrend} tone="leaf" title="방문자(로그인 전, 일)" caption="합계" value={num(visitSum)} data={visitDays.map((d) => ({ date: d.date, v: d.visitors }))} />
            </>
          ) : (
            <p className="tile p-4 text-[14px] font-semibold text-faint md:col-span-2">방문자는 이 기능을 배포한 날부터 센다. 아직 기록이 없다</p>
          )}
          <Trend {...trend} title="신규 가입자(일)" caption="합계" value={num(windowSum("signups"))} data={series("signups")} />
          <Trend {...trend} tone="leaf" title="전체 가입자" caption={endLabel} value={num(last?.users ?? 0)} data={series("users")} />
          <Trend {...trend} title="신규 구독자(일)" caption="합계" value={num(windowSum("newSubs"))} data={series("newSubs")} />
          <Trend {...trend} tone="leaf" title="전체 구독자" caption={endLabel} value={num(last?.subs ?? 0)} data={series("subs")} />
          <Trend {...trend} tone="mango" title="당일 매출" caption="합계" value={won(windowSum("revenue"))} unit="원" data={series("revenue")} />
          <Trend {...trend} tone="leaf" title="전체 매출(누적)" caption={endLabel} value={won(last?.revenueTotal ?? 0)} unit="원" data={series("revenueTotal")} />
          <Trend {...trend} tone="mango" title="지출(API, 일)" caption="합계" value={won(windowSum("cost"))} unit="원" data={series("cost")} />
          <Trend {...trend} tone="leaf" title="누적 지출(API)" caption={endLabel} value={won(last?.costTotal ?? 0)} unit="원" data={series("costTotal")} />
        </div>
        <Note>
          위 칸은 고른 기간, 추이는 끝날까지 최근 {TREND_MIN_DAYS}일(기간이 더 길면 그 기간). 가입 전환율 = 가입 ÷ 로그인 안 한 방문자(웹 소개·로그인·둘러보기·분야 페이지, 앱
          로그인 화면). 방문자는 날마다 따로 센 순방문자의 합이고, 방문자를 센 날의 가입만 나눈다. 구독자 = 실제 스토어 유료 구독(체험·테스트 빼고), 그날 끝에 구독
          기간 안인 사람. 매출 = 환불 뺀 실제 결제, 스토어 수수료 전. 지출 = API 비용(Gemini 기록값 + Google TTS 무료 한도를 넘은 만큼), 서버·도메인 같은 고정비는
          빠진다. 달러는 {num(KRW_PER_USD)}원으로 셈
        </Note>
      </Section>
    </>
  );
}
