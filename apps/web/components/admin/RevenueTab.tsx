import type { AdminRange } from "@/lib/admin-range";
import { type RevenueStats, ratio, revenueKrw } from "@/lib/admin-stats";
import { db, must } from "@/lib/server/db";
import { Card, Note, Row, Section, Stat, num, pct } from "./parts";

// 관리자 매출·콘텐츠 탭. 숫자는 admin_stats_revenue(supabase/migrations/20261022100000_admin_tabs.sql).
// 결제는 실제 스토어 결제만(테스트·운영자 권한 뺌). Premium·지갑 잔액·관심사는 지금 값, 나머지는 기간.

const KRW_PER_USD = 1400;
/** 스토어 수수료(애플·구글 소규모 사업자 15%로 본다) */
const STORE_FEE = 0.15;
/** Google TTS Chirp 3 HD 매월 무료 글자 수, 넘으면 100만 자당 $30 */
const TTS_FREE_CHARS = 1_000_000;

const won = (krw: number) => `${Math.round(krw).toLocaleString("ko-KR")}원`;

export async function RevenueTab({ range }: { range: AdminRange }) {
  const s = must(await db.rpc("admin_stats_revenue", { p_from: range.from, p_to: range.to }), "admin_stats_revenue") as RevenueStats;
  const { revenue: rev, wallet: w } = s;
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
  const ttsShare = Math.min(1, s.cost.ttsMonthChars / TTS_FREE_CHARS);
  const ttsBill = (Math.max(0, s.cost.ttsMonthChars - TTS_FREE_CHARS) * 30) / 1e6;
  const fbTotal = (s.feedback.more ?? 0) + (s.feedback.skip ?? 0);
  const topMax = Math.max(1, ...s.content.topics.map((t) => t.users));

  return (
    <>
      <Section id="sec-revenue" title="매출·결제">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="매출(추정)" value={won(sales)} sub={`결제 ${num(rev.payers)}명${rev.unpriced ? ` · 금액 모름 ${num(rev.unpriced)}건` : ""}`} />
          <Stat label="Premium" value={num(rev.premium)} sub={premiumSub} />
          <Stat label="체험 → 결제" value={pct(ratio(rev.trialsConverted, rev.trialsEnded))} sub={`끝난 체험 ${num(rev.trialsEnded)} 중 ${num(rev.trialsConverted)}명`} />
          <Stat label="가입 → 결제" value={pct(ratio(rev.cohortPaid, rev.cohortSignups))} sub={`기간 가입자 ${num(rev.cohortSignups)} 중 ${num(rev.cohortPaid)}명`} />
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
            <Row label="좋아요" value={`${num(s.feedback.more ?? 0)} (전체 ${num(s.feedbackAll.more ?? 0)})`} />
            <Row label="싫어요" value={`${num(s.feedback.skip ?? 0)} (전체 ${num(s.feedbackAll.skip ?? 0)})`} />
            <Row label="좋아요 비율" value={pct(ratio(s.feedback.more ?? 0, fbTotal))} />
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
    </>
  );
}
