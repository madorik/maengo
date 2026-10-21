import { type AdminRange, spanDays } from "@/lib/admin-range";
import { type GrowthStats, type Platform, durationLabel, funnelSteps, ratio } from "@/lib/admin-stats";
import { db, must } from "@/lib/server/db";
import { Card, Funnel, Note, Retention, Row, Section, Stat, Trend, md, num, pct } from "./parts";

// 관리자 가입·활동 탭(처음 여는 탭). 숫자는 admin_stats_growth(supabase/migrations/20261022100000_admin_tabs.sql).
// 가입과 온보딩은 따로 센다: 온보딩 완료 = 기간에 온보딩을 마친 사람(가입은 더 전이어도), 온보딩율·퍼널·재방문 = 기간에 가입한 사람 기준.
// 활동 = 그날 앱을 열었거나(visits) 읽었거나 들은 사람. DAU는 마지막 날, MAU는 마지막 날까지 30일. 플랫폼별 DAU는 앱을 연 기록만으로.

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "web", label: "웹" },
  { id: "ios", label: "iOS" },
  { id: "android", label: "Android" },
];

/** 하루 평균: 10 밑은 소수 한 자리 */
const avgLabel = (sum: number, days: number) => {
  const avg = sum / days;
  return avg < 10 ? avg.toFixed(1) : num(Math.round(avg));
};

export async function GrowthTab({ range, today }: { range: AdminRange; today: string }) {
  const s = must(await db.rpc("admin_stats_growth", { p_from: range.from, p_to: range.to }), "admin_stats_growth") as GrowthStats;
  const { users: u, activity: a, features: f } = s;
  const days = spanDays(range);
  const activePeak = Math.max(0, ...s.daily.map((d) => d.active));
  // DAU/MAU(고착도): 날마다 그날 DAU ÷ 그날까지 30일 MAU. MAU가 0인 날은 평균에서 뺀다
  const sticky = s.daily.map((d) => ({ date: d.date, v: d.mau ? Math.round((d.active / d.mau) * 100) : 0 }));
  const stickyDays = s.daily.filter((d) => d.mau > 0);
  const stickyAvg = stickyDays.length ? stickyDays.reduce((n, d) => n + d.active / d.mau, 0) / stickyDays.length : null;
  // 플랫폼별 DAU는 같은 눈금으로 그린다(어느 쪽이 큰지 바로 보이게)
  const platformMax = Math.max(0, ...s.daily.flatMap((d) => PLATFORMS.map((p) => d[p.id])));
  const endLabel = range.to === today ? "오늘" : md(range.to);
  const trend = { range, today };

  return (
    <>
      <Section id="sec-signup" title="가입·온보딩">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="가입" value={num(u.signups)} sub={`전체 회원 ${num(u.total)}`} />
          <Stat label="온보딩 완료" value={num(u.onboardedInRange)} sub={`지금까지 ${num(u.onboarded)}명`} />
          <Stat label="온보딩율" value={pct(ratio(u.cohortOnboarded, u.signups))} sub={`가입 ${num(u.signups)} 중 ${num(u.cohortOnboarded)} · 중간 ${durationLabel(u.onboardMedianMin)}`} />
          <Stat label="온보딩 안 함" value={num(u.pending)} sub={`지금, 전체 회원의 ${pct(ratio(u.pending, u.total))}`} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Trend {...trend} title="가입" caption="합계" value={num(u.signups)} data={s.daily.map((d) => ({ date: d.date, v: d.signups }))} />
          <Trend {...trend} tone="leaf" title="온보딩 완료" caption="합계" value={num(u.onboardedInRange)} data={s.daily.map((d) => ({ date: d.date, v: d.onboarded }))} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="가입 퍼널">
            <Funnel steps={funnelSteps(s.funnel)} paid={s.funnel.paid} />
            <Note>기간에 가입한 사람 기준, 오늘까지. 앞 단계를 지난 사람만 다음 단계로 센다. 다시 옴 = 가입 다음 날 이후 다시 연 사람</Note>
          </Card>
          <Card title="재방문(가입 주별)">
            <Retention rows={s.retention} />
            <Note>D1·D7·D30 = 가입하고 1·7·30일 뒤 그날 앱을 열거나 읽거나 들은 비율. 그날이 다 지난 사람만 센다</Note>
          </Card>
        </div>
      </Section>

      <Section id="sec-activity" title="활동">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="DAU" value={num(a.dau)} sub={`${endLabel} · 최고 ${num(activePeak)}명`} />
          <Stat label="MAU" value={num(a.mau)} sub={`DAU/MAU ${pct(ratio(a.dau, a.mau))}`} />
          <Stat label="활동한 사람" value={num(a.active)} sub={`읽음 ${num(a.reads)} · 들음 ${num(a.listens)}`} />
          <Stat label="소식 받은 사람" value={num(a.fed)} sub={`알림 보냄 ${num(a.pushSent)}`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Trend {...trend} title="DAU" caption="하루 평균" value={avgLabel(s.daily.reduce((n, d) => n + d.active, 0), days)} data={s.daily.map((d) => ({ date: d.date, v: d.active }))} />
          <Trend {...trend} title="MAU(그날까지 30일)" caption={endLabel} value={num(a.mau)} data={s.daily.map((d) => ({ date: d.date, v: d.mau }))} />
          <Trend {...trend} title="DAU/MAU" caption="평균" value={pct(stickyAvg)} unit="%" data={sticky} />
          {PLATFORMS.map((p) => (
            <Trend
              key={p.id}
              {...trend}
              title={`${p.label} DAU`}
              caption="하루 평균"
              value={avgLabel(s.daily.reduce((n, d) => n + d[p.id], 0), days)}
              scaleMax={platformMax}
              data={s.daily.map((d) => ({ date: d.date, v: d[p.id] }))}
            />
          ))}
          <Trend {...trend} tone="mango" title="읽음(글을 연 소식)" caption="합계" value={num(a.reads)} data={s.daily.map((d) => ({ date: d.date, v: d.reads }))} />
          <Trend {...trend} tone="mango" title="들음(음성으로 들은 소식)" caption="합계" value={num(a.listens)} data={s.daily.map((d) => ({ date: d.date, v: d.listens }))} />
          <Card title="기능 사용">
            <Row label="읽은 사람" value={`${num(f.readers)} (${pct(ratio(f.readers, a.active))})`} />
            <Row label="들은 사람" value={`${num(f.listeners)} (${pct(ratio(f.listeners, a.active))})`} />
            <Row label="플레이리스트 담아 둠" value={num(f.playlist)} />
            <Row label="내 관심 링크 넣음" value={num(f.links)} />
            <Row label="알림 켬" value={`${num(u.pushOn)} (${pct(ratio(u.pushOn, u.total))})`} />
            <Note>읽은·들은 사람은 기간, 괄호는 활동한 사람 대비. 나머지는 지금</Note>
          </Card>
        </div>
        <p className="text-[12px] font-semibold text-faint">
          웹·iOS·Android DAU는 그날 앱을 연 기록으로 센다(2026-10-22부터, 세 그래프는 같은 눈금). 한 사람이 웹과 앱을 둘 다 열면 양쪽에 다 센다
        </p>
      </Section>
    </>
  );
}
