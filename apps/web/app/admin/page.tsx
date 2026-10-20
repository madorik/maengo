import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { kstDate } from "@maengo/core/kst";
import { Card, Chips, Funnel, Note, RangeBar, Retention, Row, Section, Stat, Trend, md, num, pct } from "@/components/admin/parts";
import { parseAdminRange, spanDays } from "@/lib/admin-range";
import { type AdminStats, durationLabel, funnelSteps, ratio, revenueKrw } from "@/lib/admin-stats";
import { isAdmin } from "@/lib/server/admin";
import { adminAlerts } from "@/lib/server/admin-alerts";
import { db, must } from "@/lib/server/db";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

// 관리자 통계(TODO.md 1번). 숫자는 DB 함수 admin_stats(supabase/migrations/20261020100000_admin_stats_funnel.sql) 한 번으로 모은다. 날짜는 한국 시간.
// 기간(?from=&to=, 기본 오늘까지 14일)은 가입·온보딩·활동·결제·콘텐츠·비용·알림 결과에 걸린다. 회원 수·Premium·지갑 잔액·관심사·작업 상태는 지금 값.
// 가입과 온보딩은 따로 센다: 온보딩 완료 = 기간에 온보딩을 마친 사람(가입은 더 전이어도), 온보딩율·퍼널·재방문 = 기간에 가입한 사람 기준.
// 활동 = 그날 앱을 열었거나(visits) 읽었거나 들은 사람. DAU는 마지막 날, MAU는 마지막 날까지 30일.
// 개인을 알아볼 수 있는 값(이메일·이름)은 보여 주지 않는다.

const KRW_PER_USD = 1400;
/** 스토어 수수료(애플·구글 소규모 사업자 15%로 본다) */
const STORE_FEE = 0.15;
/** Google TTS Chirp 3 HD 매월 무료 글자 수, 넘으면 100만 자당 $30 */
const TTS_FREE_CHARS = 1_000_000;
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

type Props = { searchParams: Promise<{ from?: string | string[]; to?: string | string[] }> };

const won = (krw: number) => `${Math.round(krw).toLocaleString("ko-KR")}원`;
const kst = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const when = (iso: string | null) => (iso ? kst.format(new Date(iso)) : "—");

export default async function AdminPage({ searchParams }: Props) {
  const profile = await requireProfile();
  if (!isAdmin(profile)) notFound();
  const today = kstDate();
  const range = parseAdminRange(await searchParams, today);
  const [stats, alerts] = await Promise.all([db.rpc("admin_stats", { p_from: range.from, p_to: range.to }), adminAlerts()]);
  const s = must(stats, "admin_stats") as AdminStats;
  const { users: u, revenue: rev, wallet: w, features: f } = s;
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
  const endLabel = range.to === today ? "오늘" : md(range.to);
  const trend = { range, today };
  const sales = revenueKrw(rev, KRW_PER_USD);
  // 지금 Premium을 스토어 구독 상태로 나눈다. 구독 기록이 없는 Premium은 운영자가 준 것(RevenueCat 운영자 권한 포함)
  const subPaying = (rev.subs.active ?? 0) + (rev.subs.past_due ?? 0);
  const subTrial = rev.subs.trial ?? 0;
  const premiumOther = Math.max(0, rev.premium - subPaying - subTrial);
  // 좁은 칸이라 0인 항목은 뺀다(유료는 늘 보인다)
  const premiumSub = [
    `유료 ${num(subPaying)}`,
    subTrial ? `체험 ${num(subTrial)}` : "",
    rev.subs.past_due ? `결제 문제 ${num(rev.subs.past_due)}` : "",
    rev.cancelAtEnd ? `해지 예정 ${num(rev.cancelAtEnd)}` : "",
    premiumOther ? `그 밖 ${num(premiumOther)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

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
            <Stat label="DAU" value={num(s.activity.dau)} sub={`${endLabel} · 최고 ${num(activePeak)}명`} />
            <Stat label="MAU" value={num(s.activity.mau)} sub={`DAU/MAU ${pct(ratio(s.activity.dau, s.activity.mau))}`} />
            <Stat label="활동한 사람" value={num(s.activity.active)} sub={`읽음 ${num(s.activity.reads)} · 들음 ${num(s.activity.listens)}`} />
            <Stat label="소식 받은 사람" value={num(s.activity.fed)} sub={`알림 보냄 ${num(s.ops.deliveries.sent ?? 0)}`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Trend {...trend} title="DAU" caption="하루 평균" value={activeAvg < 10 ? activeAvg.toFixed(1) : num(Math.round(activeAvg))} data={s.daily.map((d) => ({ date: d.date, v: d.active }))} />
            <Trend {...trend} title="MAU(그날까지 30일)" caption={endLabel} value={num(s.activity.mau)} data={s.daily.map((d) => ({ date: d.date, v: d.mau }))} />
            <Trend {...trend} title="DAU/MAU" caption="평균" value={pct(stickyAvg)} unit="%" data={sticky} />
            <Trend {...trend} tone="mango" title="읽음(글을 연 소식)" caption="합계" value={num(s.activity.reads)} data={s.daily.map((d) => ({ date: d.date, v: d.reads }))} />
            <Trend {...trend} tone="mango" title="들음(음성으로 들은 소식)" caption="합계" value={num(s.activity.listens)} data={s.daily.map((d) => ({ date: d.date, v: d.listens }))} />
            <Card title="기능 사용">
              <Row label="읽은 사람" value={`${num(f.readers)} (${pct(ratio(f.readers, s.activity.active))})`} />
              <Row label="들은 사람" value={`${num(f.listeners)} (${pct(ratio(f.listeners, s.activity.active))})`} />
              <Row label="플레이리스트 담아 둠" value={num(f.playlist)} />
              <Row label="내 관심 링크 넣음" value={num(f.links)} />
              <Row label="알림 켬" value={`${num(u.pushOn)} (${pct(ratio(u.pushOn, u.total))})`} />
              <Note>읽은·들은 사람은 기간, 괄호는 활동한 사람 대비. 나머지는 지금</Note>
            </Card>
          </div>
        </Section>

        <Section id="sec-revenue" title="매출·결제">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="매출(추정)" value={won(sales)} sub={`결제 ${num(rev.payers)}명${rev.unpriced ? ` · 금액 모름 ${num(rev.unpriced)}건` : ""}`} />
            <Stat label="Premium" value={num(rev.premium)} sub={premiumSub} />
            <Stat label="체험 → 결제" value={pct(ratio(rev.trialsConverted, rev.trialsEnded))} sub={`끝난 체험 ${num(rev.trialsEnded)} 중 ${num(rev.trialsConverted)}명`} />
            <Stat label="가입 → 결제" value={pct(ratio(s.funnel.paid, s.funnel.signups))} sub={`기간 가입자 중 ${num(s.funnel.paid)}명`} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="결제">
              <Row label="구독 결제(갱신 포함)" value={`${num(rev.subscriptions)}건`} />
              <Row label="체험 시작" value={`${num(rev.trials)}명`} />
              <Row label="맹고 묶음" value={`${num(rev.packs)}건 · ${num(rev.packMaengo)}맹고`} />
              <Row label="환불" value={`${num(rev.refunds)}건`} />
              <Row label="원화 결제" value={won(rev.krw)} />
              <Row label="그 밖 통화" value={`$${rev.usd.toFixed(2)} (${won(rev.usd * KRW_PER_USD)})`} />
              <Row label={`정산 예상(수수료 ${Math.round(STORE_FEE * 100)}%)`} value={won(sales * (1 - STORE_FEE))} />
              <Note>실제 스토어 결제만(테스트·운영자 권한은 뺀다), 환불한 결제는 금액에서 뺀다. 달러는 {num(KRW_PER_USD)}원으로 셈</Note>
            </Card>
            <Card title="맹고 지갑">
              <Row label="더 받기에 씀" value={`${num(w.used)}맹고 · ${num(w.users)}명`} />
              <Row label="사서 들어옴" value={`${num(w.bought)}맹고`} />
              <Row label="가입 선물" value={`${num(w.gifted)}맹고`} />
              <Row label="환불로 회수" value={`${num(w.clawback)}맹고`} />
              <Row label="지갑에 남은 맹고(지금)" value={`${num(w.balance)}맹고`} />
              <Note>더 받기는 되돌려 준 맹고를 뺀 값. 테스트 결제로 들어온 맹고는 뺀다</Note>
            </Card>
          </div>
        </Section>

        <Section id="sec-content" title="콘텐츠·비용">
          <div className="grid gap-3 md:grid-cols-3">
            <Card title="비용(추정)">
              <Row label="Gemini 요약·임베딩" value={`$${s.cost.geminiUsd.toFixed(2)} (${won(s.cost.geminiUsd * KRW_PER_USD)})`} />
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
              <Row label="좋아요 비율" value={pct(ratio(s.activity.feedback.more ?? 0, fbTotal))} />
            </Card>
          </div>
          <Card title="관심사(고른 사람 수)">
            {s.content.topics.length === 0 ? (
              <p className="text-[14px] font-semibold text-faint">아직 없어요</p>
            ) : (
              <ol className="grid gap-x-8 gap-y-1.5 md:grid-cols-2">
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
        </Section>

        <Section id="sec-ops" title="운영">
          <Card title="작업·알림">
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[13px] font-extrabold text-sub">알림 결과</p>
                <Chips data={s.ops.deliveries} labels={DELIVERY_LABEL} />
              </div>
              <div>
                <p className="text-[13px] font-extrabold text-sub">알림 기기</p>
                <Chips data={s.ops.devices} labels={{ web: "웹", ios: "iOS", android: "Android" }} />
              </div>
            </div>
          </Card>
        </Section>
      </main>
    </div>
  );
}
