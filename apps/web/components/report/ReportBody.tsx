import Link from "next/link";
import { formatChange, formatMarket, marketChange, weekPoints, type ReportMarket } from "@maengo/core/markets";
import {
  busiestDay, dayName, REPORT_TONES, TONE_NAME, toneTotals, type ReportCounts, type ReportData, type ReportDay, type ReportGroup, type ReportPeriod, type ReportTone,
} from "@maengo/core/report";
import { IconChevronRight } from "@/components/icons";
import { ToneIcon } from "@/components/ui/ToneIcon";
import { SECTION_LABEL, sectionOf } from "@maengo/core/sections";
import { articleToken } from "@/lib/server/share-token";
import { ReportAppHint } from "./ReportAppHint";
import { ReportImpact, type ImpactView } from "./ReportImpact";

// 주간 리포트 한 편. 위에서부터 총평 → 내 관심사에 준 영향(예전 리포트는 맞춤 체크) → 지난주 경제는 → 나의 한 주(숫자 네 칸, 요일별로 본 흐름 차트) → 큰 소식 챙긴 정도
// → 분야별 정리 → 많이 본 분야 → 다음 주 지켜볼 것 → 자주 나온 키워드 → 놓친 주요 소식.
// 2026-11-25 사용자: 지난주 받은 소식이 경제와 내 관심사에 어떤 영향이었는지 사용자 관점으로, 숫자는 차트로. 시장 지표는 한국은행 ECOS(pipeline/src/lib/markets.ts)
// 2026-11-25 6안: 총평은 연한 주황 둥근 상자, 카드·숫자 칸은 회색 둥근 면(테두리 없음), 그래프 선은 검정(가장 많이 본 날만 주황), 섹션 머리는 18px/800.
// 숫자 네 칸은 총평 상자 안에서 '나의 한 주'로 옮겼고(Free도 같은 자리), 다음 주 지켜볼 것은 시안처럼 분야별 정리 뒤로 내렸다.
// Free는 이 전체가 아니라 총평·숫자와 맛보기만 본다(ReportFree.tsx, 2026-11-19). 차트는 DB에서 센 숫자라 지어낸 말이 없고, 이 칸이 생기기 전 리포트에는 없어 그리지 않는다
// 숫자·막대는 DB에서 센 값, 총평·맞춤 체크·다음 주 지켜볼 것·분야별 정리·자주 나온 키워드는 Gemini가 쓴 것(pipeline/src/reports.ts). 맹고-문서/리포트.md
// 맞춤 체크(2026-11-11 사용자: 주간 리포트도 맞춤형 인사이트로): 내 맞춤 정보에 이번 주 소식이 무슨 뜻이었는지. 이름은 넣지 않는다

/** 앞 기간 이름(견주는 말에 쓴다) */
const before = (period: ReportPeriod) => (period === "week" ? "지난주" : "");

/** 총평 상자 안 알약에 쓰는 짧은 이름(전체 이름은 읽어 주는 말에) */
const TONE_SHORT: Record<ReportTone, string> = { minus: "부담", plus: "긍정", watch: "지켜볼" };
const TONE_COLOR: Record<ReportTone, string> = { minus: "text-minus", plus: "text-plus", watch: "text-watch" };

/** 'YYYY-MM-DD' → '11월 20일' */
const monthDay = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

/** 분야 알약(테두리 알약, 6안 카드 문법) */
const TAG = "inline-flex h-6 items-center rounded-full border border-line-dark px-2.5 text-[12px] font-semibold";

export function ReportBody({ period, start, data }: { period: ReportPeriod; start: string; data: ReportData }) {
  const { counts, prev, digest, groups, items } = data;
  const missed = data.missed.filter((id) => items[id]);
  const interests = impactViews(data, start);
  return (
    <div className="flex flex-col gap-8">
      <ReportVerdict headline={digest.headline} tones={toneTotals(digest.personal)} />

      {interests.length ? <ReportImpact interests={interests} /> : <PersonalCheck personal={digest.personal ?? []} items={items} />}

      {!!data.markets?.length && <EconomyBlock markets={data.markets} start={start} economy={digest.economy} />}

      <ReportBlock title="나의 한 주">
        <ReportWeekStats period={period} counts={counts} prev={prev} />
        {data.days && <RhythmBlock days={data.days} openDays={data.openDays} prevOpenDays={data.prevOpenDays} />}
      </ReportBlock>

      {data.weight && <WeightMeter weight={data.weight} hasMissed={missed.length > 0} />}

      <ReportBlock title="분야별로 보면">
        <ul className="-mt-1.5">
          {digest.sections.map((s) => {
            const g = groups.find((x) => x.name === s.group);
            return (
              <li key={s.group} className="border-b border-line py-3.5 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="min-w-0 truncate text-[15px] font-bold tracking-[-0.02em]">{s.group}</h3>
                  {g && <span className="shrink-0 text-[13px] font-semibold text-sub tabular-nums">{`받은 ${g.received}개 중 ${g.consumed}개 봄`}</span>}
                </div>
                {g && g.received > 0 && (
                  <span aria-hidden="true" className="mt-2 block h-1.5 overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${(g.consumed / g.received) * 100}%` }} />
                  </span>
                )}
                <p className="mt-2 text-[15px] font-medium leading-[1.7] text-ink/80">{s.summary}</p>
                <ItemLinks ids={s.ids} items={items} className="mt-2" />
              </li>
            );
          })}
        </ul>
      </ReportBlock>

      <ReportBlock title="많이 본 분야">
        <GroupBars groups={groups} period={period} hasPrev={!!prev} />
      </ReportBlock>

      {!!digest.next?.length && (
        <ReportBlock title="다음 주 지켜볼 것">
          <ul className="flex flex-col gap-2">
            {digest.next.map((n) => {
              const id = n.ids.find((x) => items[x]);
              const text = (
                <>
                  <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-mango" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-[15px] font-semibold leading-[1.6]">{n.text}</span>
                  {id !== undefined && <IconChevronRight className="mt-1 size-4 shrink-0 text-faint" />}
                </>
              );
              return (
                <li key={n.text}>
                  {id !== undefined ? (
                    <Link href={`/article/${articleToken(id)}`} aria-label={`${n.text}, 근거 소식: ${items[id]!.title}`} className="flex items-start gap-3 rounded-2xl bg-snow px-4 py-3.5 no-underline hover:bg-line">
                      {text}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 rounded-2xl bg-snow px-4 py-3.5">{text}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </ReportBlock>
      )}

      {/* 자주 나온 키워드: 누르면 보관함에서 그 말로 찾는다. '내 키워드로 넣기'·'이번 주에 넣은 관심사'는 뺐다
          (2026-11-10 개편: 키워드를 고르거나 넣게 하지 않고 맹고가 읽고 듣는 기록으로 맞춘다).
          2026-11-25 6안: 테두리 알약 칩 줄. 근거 소식 제목 줄은 칩에 담기지 않아 뺐다(누르면 보관함 검색으로 가서 소식이 나온다) */}
      {digest.keywords.length > 0 && (
        <ReportBlock title="자주 나온 키워드">
          <ul className="flex flex-wrap gap-2">
            {digest.keywords.map((k) => (
              <li key={k.word}>
                <Link href={`/library?q=${encodeURIComponent(k.word)}`} className="inline-flex h-9 items-center rounded-full border border-line-dark px-3.5 text-[14px] font-semibold no-underline hover:bg-snow">
                  {k.word}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] font-medium text-sub">누르면 보관함에서 찾아 줘요</p>
        </ReportBlock>
      )}

      {missed.length > 0 && (
        <ReportBlock title="놓친 주요 소식">
          {/* 2026-11-25 사용자 '뉴스 카드가 촌스럽다': 회색 상자 대신 선으로 나눈 줄, 분야는 제목 위 주황 글자 */}
          <ul className="flex flex-col">
            {missed.map((id) => {
              const it = items[id]!;
              const section = sectionOf({ category: it.category });
              return (
                <li key={id} className="border-t border-line first:border-t-0">
                  <Link href={`/article/${articleToken(id)}`} className="block py-4 no-underline">
                    {section && <span className="block text-[12px] font-bold text-mango-deep">{SECTION_LABEL[section]}</span>}
                    <span className="mt-1 line-clamp-2 block text-[16px] font-bold leading-[1.45] tracking-[-0.03em]">{it.title}</span>
                    {it.date && <span className="mt-1.5 block text-[13px] font-medium text-sub">{monthDay(it.date)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </ReportBlock>
      )}

      {/* 웹 회원에게: 다음 리포트는 앱 알림으로(앱 안·앱을 쓰는 회원에겐 안 보인다) */}
      <ReportAppHint />
    </div>
  );
}

/**
 * 한 주 총평(2026-11-25 6안): 연한 주황 둥근 상자에 한 줄 총평, 내 관심사에 닿은 소식을 쪽마다 센 알약(부담 빨강·긍정 파랑·지켜볼 회색).
 * 바탕이 토큰이라 어두운 화면에서도 같이 어두워진다(알약은 bg-paper). Free도 이것은 그대로 본다
 */
export function ReportVerdict({ headline, tones }: { headline: string; tones?: Record<ReportTone, number> | null }) {
  const shown = tones ? REPORT_TONES.filter((t) => tones[t] > 0) : [];
  return (
    <section aria-label="한 주 총평" className="rounded-[18px] bg-mango-tint px-[18px] pb-[18px] pt-5">
      <p className="text-[20px] font-extrabold leading-[1.45] tracking-[-0.04em] text-balance">{headline}</p>
      {shown.length > 0 && (
        <ul aria-label="내 관심사에 닿은 소식" className="mt-3.5 flex flex-wrap gap-1.5">
          {shown.map((t) => (
            <li key={t} aria-label={`${TONE_NAME[t]} ${tones![t]}개`} className={`inline-flex h-7 items-center gap-1 rounded-full bg-paper px-2.5 text-[12px] font-bold tabular-nums ${TONE_COLOR[t]}`}>
              <ToneIcon tone={t} className="size-3" />
              {`${TONE_SHORT[t]} ${tones![t]}개`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 숫자 네 칸(앞 주와의 차이를 말로). 회색 둥근 면 2×2. Free도 총평 아래에서 이것을 본다 */
export function ReportWeekStats({ period, counts, prev }: { period: ReportPeriod; counts: ReportCounts; prev: ReportCounts | null }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      <Stat label="받은 소식" now={counts.received} prev={prev?.received} period={period} />
      <Stat label="본 소식" now={counts.consumed} prev={prev?.consumed} period={period} />
      <Stat label="들은 소식" now={counts.listened} prev={prev?.listened} period={period} />
      <Stat label="북마크" now={counts.bookmarked} prev={prev?.bookmarked} period={period} />
    </dl>
  );
}

/** 맞춤 체크: 내 맞춤 정보·읽은 소식으로 짚은 이번 주(쪽을 나누기 전 리포트). 회색 둥근 카드 한 칸씩. 근거 소식을 누르면 글 화면 */
function PersonalCheck({ personal, items }: { personal: NonNullable<ReportData["digest"]["personal"]>; items: ReportData["items"] }) {
  if (!personal.length) return null;
  return (
    <section aria-labelledby="report-match">
      <h2 id="report-match" className="text-[18px] font-extrabold tracking-[-0.035em]">
        맞춤 체크
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {personal.map((x) => (
          <article key={x.title} className="rounded-2xl bg-snow px-4 pb-2 pt-4">
            <span className={TAG}>{x.about}</span>
            <h3 className="mt-2.5 text-[16px] font-extrabold leading-[1.45] tracking-[-0.03em]">{x.title}</h3>
            <p className="mt-1.5 text-[15px] font-medium leading-[1.7] text-ink/80">{x.text}</p>
            <ItemLinks ids={x.ids} items={items} className="mt-2" rule="border-line-dark/40" />
          </article>
        ))}
      </div>
    </section>
  );
}

/** 섹션 머리(제목 18px/800, 6안)와 본문. Free 화면(ReportFree)도 같이 쓴다 */
export function ReportBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-[18px] font-extrabold tracking-[-0.035em]">{title}</h2>
      {children}
    </section>
  );
}

/** 숫자 칸. 앞 기간이 있으면 차이를 말로 아래에('지난주보다 8개 많아요') */
function Stat({ label, now, prev, period }: { label: string; now: number; prev: number | undefined; period: ReportPeriod }) {
  const diff = prev === undefined ? null : now - prev;
  return (
    <div className="rounded-2xl bg-snow px-4 py-3.5">
      <dt className="text-[12px] font-semibold text-sub">{label}</dt>
      <dd className="mt-1 font-round text-[22px] font-extrabold tabular-nums">{now}</dd>
      {diff !== null && (
        <dd className="mt-0.5 text-[12px] font-semibold text-sub">{diff === 0 ? `${before(period)}와 같아요` : `${before(period)}보다 ${Math.abs(diff)}개 ${diff > 0 ? "많아요" : "적어요"}`}</dd>
      )}
    </div>
  );
}

/** 분야마다 받은 수(회색 막대 길이)와 그중 본 수(검정으로 채운 부분). 본 수 많은 순 */
function GroupBars({ groups, period, hasPrev }: { groups: ReportGroup[]; period: ReportPeriod; hasPrev: boolean }) {
  const rows = [...groups].sort((a, b) => b.consumed - a.consumed || b.received - a.received);
  const max = Math.max(1, ...rows.map((g) => g.received));
  // 앞 기간보다 가장 많이 늘어난 분야(3개 넘게 늘었을 때만 한 줄로)
  const up = hasPrev ? [...rows].sort((a, b) => b.consumed - b.prevConsumed - (a.consumed - a.prevConsumed))[0] : undefined;
  const upBy = up ? up.consumed - up.prevConsumed : 0;
  // 앞 기간보다 2개 이상 늘거나 줄어든 분야(많이 바뀐 순, 4개까지)
  const moves = hasPrev
    ? rows
        .map((g) => ({ g, d: g.consumed - g.prevConsumed }))
        .filter((x) => Math.abs(x.d) >= 2)
        .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
        .slice(0, 4)
    : [];
  return (
    <div className="rounded-2xl bg-snow p-4">
      <ul className="flex flex-col gap-3">
        {rows.map((g) => (
          <li key={g.id} className="grid grid-cols-[minmax(0,6.5rem)_1fr_3.25rem] items-center gap-3">
            <span className="truncate text-[14px] font-semibold">{g.name}</span>
            <span className="h-2.5 rounded-full bg-paper" aria-hidden="true">
              <span className="block h-full rounded-full bg-line-dark" style={{ width: `${(g.received / max) * 100}%` }}>
                <span className="block h-full rounded-full bg-ink" style={{ width: `${g.received ? (g.consumed / g.received) * 100 : 0}%` }} />
              </span>
            </span>
            <span className="text-right text-[13px] font-semibold text-sub tabular-nums">
              <span className="text-ink">{g.consumed}</span>/{g.received}
              <span className="sr-only">{`, 받은 ${g.received}개 중 ${g.consumed}개 봄`}</span>
            </span>
          </li>
        ))}
      </ul>
      <p aria-hidden="true" className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-sub">
        <span className="inline-block h-2.5 w-4 rounded-full bg-ink" />본 소식
        <span className="ml-2 inline-block h-2.5 w-4 rounded-full bg-line-dark" />받은 소식
      </p>
      {up && upBy >= 3 && (
        <p className="mt-3 border-t border-line-dark/40 pt-3 text-[15px] font-bold leading-relaxed">
          {`${up.name} 소식을 ${before(period)}보다 ${upBy}개 더 봤어요.`}
        </p>
      )}
      {moves.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-dark/40 pt-3">
          <span className="text-[12px] font-semibold text-sub">{before(period)}보다 본 소식</span>
          {moves.map(({ g, d }) => (
            <span key={g.id} className="rounded-full bg-paper px-2.5 py-1 text-[12px] font-bold tabular-nums">
              {g.name} <span className={d > 0 ? "text-leaf-dark" : "text-sub"}>{d > 0 ? `+${d}` : `−${-d}`}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** 막대 자리 높이(px). 받은 소식이 가장 많은 날이 이 높이를 채운다 */
const BAR_AREA = 112;

/**
 * 요일별로 본 흐름(2026-11-19 사용자: 리포트에 차트처럼 유익하게 볼 내용). 그날 받은 소식(연한 막대)과 그중 본 소식(진한 부분),
 * 앱을 연 날(점). 가장 많이 본 날만 주황으로 숫자를 붙이고(2026-11-25 6안), 나머지는 막대에 올리면 뜨는 말(title)과 표로 읽는다
 */
function RhythmBlock({ days, openDays, prevOpenDays }: { days: ReportDay[]; openDays?: string[]; prevOpenDays?: number | null }) {
  const max = Math.max(1, ...days.map((d) => d.received));
  const best = busiestDay(days);
  const opened = new Set(openDays ?? []);
  const known = openDays !== undefined;
  return (
    <>
      <h3 className="mt-[22px] text-[14px] font-extrabold">요일별로 본 흐름</h3>
      <p className="mt-1 text-[15px] font-semibold leading-relaxed">{best ? `${dayName(best.date)}요일에 가장 많이 봤어요 (${best.consumed}개)` : "이번 주엔 본 소식이 없어요"}</p>
      {known && (
        <p className="mt-0.5 text-[13px] font-medium text-sub tabular-nums">{`${opened.size}일 열었어요${prevOpenDays !== null && prevOpenDays !== undefined ? `, 지난주 ${prevOpenDays}일` : ""}`}</p>
      )}
      <div aria-hidden="true" className="mt-3 grid grid-cols-7 gap-2 border-b border-line-dark px-0.5">
        {days.map((d) => (
          <div key={d.date} title={`${dayName(d.date)}요일: 받은 ${d.received}개 중 ${d.consumed}개 봄`} className="flex flex-col items-center justify-end gap-1.5" style={{ height: BAR_AREA + 24 }}>
            {best?.date === d.date && <span className="text-[12px] font-extrabold leading-none tabular-nums">{`${d.consumed}개`}</span>}
            {d.received ? (
              <span className="relative block w-7 rounded-t-lg bg-line" style={{ height: Math.max(6, (d.received / max) * BAR_AREA) }}>
                {d.consumed > 0 && (
                  <span
                    className={`absolute inset-x-0 bottom-0 block rounded-t-lg ${best?.date === d.date ? "bg-mango" : "bg-faint"}`}
                    style={{ height: `${(d.consumed / d.received) * 100}%` }}
                  />
                )}
              </span>
            ) : (
              <span className="block h-0.5 w-7 bg-line-dark" />
            )}
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 grid grid-cols-7 gap-2 px-0.5 text-center">
        {days.map((d) => (
          <div key={d.date}>
            <span className={`block text-[12px] ${best?.date === d.date ? "font-extrabold text-ink" : "font-semibold text-sub"}`}>{dayName(d.date)}</span>
            {known && <span className={`mx-auto mt-1.5 block size-2 rounded-full ${opened.has(d.date) ? "bg-mango" : "border-2 border-line-dark"}`} />}
          </div>
        ))}
      </div>
      <p aria-hidden="true" className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold text-sub">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-full bg-faint" />본 소식
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-full bg-line" />받은 소식
        </span>
        {known && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-mango" />앱을 연 날
          </span>
        )}
      </p>
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

/** 큰 소식(무게가 큰 것)과 눈여겨볼 소식을 얼마나 챙겨 봤는지. 둘 다 받은 게 없으면 그리지 않는다 */
function WeightMeter({ weight, hasMissed }: { weight: NonNullable<ReportData["weight"]>; hasMissed: boolean }) {
  const rows = ([["큰 소식", weight.major], ["눈여겨볼 소식", weight.notable]] as const).filter(([, s]) => s.received > 0);
  if (!rows.length) return null;
  return (
    <ReportBlock title="큰 소식은 얼마나 챙겼나">
      <div className="rounded-2xl bg-snow p-4">
        <ul className="flex flex-col gap-3">
          {rows.map(([name, s]) => (
            <li key={name} className="grid grid-cols-[minmax(0,6.5rem)_1fr_3.25rem] items-center gap-3">
              <span className="truncate text-[14px] font-semibold">{name}</span>
              <span className="h-2.5 rounded-full bg-paper" aria-hidden="true">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${(s.consumed / s.received) * 100}%` }} />
              </span>
              <span className="text-right text-[13px] font-semibold text-sub tabular-nums">
                <span className="text-ink">{s.consumed}</span>/{s.received}
                <span className="sr-only">{`, ${s.received}개 중 ${s.consumed}개 챙겨 봄`}</span>
              </span>
            </li>
          ))}
        </ul>
        {hasMissed && <p className="mt-4 border-t border-line-dark/40 pt-3 text-[13px] font-semibold text-sub">놓친 큰 소식은 아래에 모았어요.</p>}
      </div>
    </ReportBlock>
  );
}

/** 근거 소식 줄. rule은 줄 사이 선 색(회색 카드 안에서는 한 단계 진하게) */
function ItemLinks({ ids, items, className = "", rule = "border-line" }: { ids: number[]; items: ReportData["items"]; className?: string; rule?: string }) {
  const shown = ids.filter((id) => items[id]);
  if (!shown.length) return null;
  return (
    <ul className={className}>
      {shown.map((id) => (
        <li key={id} className={`border-t first:border-t-0 ${rule}`}>
          <Link href={`/article/${articleToken(id)}`} className="flex min-h-11 items-center gap-2 py-2 text-[14px] font-bold no-underline hover:text-mango-deep">
            <span className="min-w-0 flex-1 truncate">{items[id]!.title}</span>
            <IconChevronRight className="size-4 shrink-0 text-faint" />
          </Link>
        </li>
      ))}
    </ul>
  );
}


/**
 * 내 관심사에 준 영향 칸에 넘길 값(쪽을 나눈 맞춤 체크만, 2026-11-25~). 소식 주소는 서버에서만 만들 수 있어 여기서 붙인다.
 * 지표 선 그래프: 그 관심사에 가까운 지표(metric)의 그 주 거래일. 흐름을 바꾼 소식이 나온 날을 그날(주말이면 다음 거래일, 없으면 마지막 날) 점으로
 */
function impactViews(data: ReportData, start: string): ImpactView[] {
  const { items } = data;
  const out: ImpactView[] = [];
  for (const p of data.digest.personal ?? []) {
    if (!p.tone || !p.tally) continue;
    const toneOf = (id: number): ReportTone | null => REPORT_TONES.find((t) => p.tally![t].includes(id)) ?? null;
    const news = p.ids
      .filter((id) => items[id])
      .map((id) => ({ id, href: `/article/${articleToken(id)}`, title: items[id]!.title, date: items[id]!.date ?? null, day: items[id]!.date ? dayName(items[id]!.date!) : null, tone: toneOf(id) }));
    const market = p.metric ? data.markets?.find((m) => m.key === p.metric) : undefined;
    out.push({
      about: p.about,
      tone: p.tone,
      title: p.title,
      text: p.text,
      ...(p.next ? { next: p.next } : {}),
      counts: { plus: p.tally.plus.length, minus: p.tally.minus.length, watch: p.tally.watch.length },
      news: news.map(({ href, title, day, tone }) => ({ href, title, day, tone })),
      chart: market ? metricChart(market, start, news) : null,
    });
  }
  return out;
}

function metricChart(m: ReportMarket, start: string, news: { title: string; date: string | null; tone: ReportTone | null }[]): ImpactView["chart"] {
  const week = weekPoints(m, start);
  const change = marketChange(m, start);
  if (week.length < 2 || !change) return null;
  const c = formatChange(m.key, change);
  // 등락은 앞 주 마지막 거래일과 견주니 그 값을 맨 앞('전 주')에 둔다(선의 처음과 끝이 등락 숫자와 맞게)
  const before = m.points.filter((p) => p.date < start).at(-1);
  const shown = before ? [before, ...week] : week;
  const offset = before ? 1 : 0;
  const label = (i: number) => (before && i === 0 ? "전 주" : dayName(shown[i]!.date));
  const marks = news.flatMap((n) => {
    if (!n.date || !n.tone) return [];
    const at = week.findIndex((p) => p.date >= n.date!);
    return [{ index: (at === -1 ? week.length - 1 : at) + offset, tone: n.tone, title: n.title }];
  });
  return {
    name: m.name,
    last: formatMarket(m.key, change.to),
    change: c.text,
    dir: c.arrow === "▲" ? "up" : c.arrow === "▼" ? "down" : "flat",
    points: shown.map((p, i) => ({ label: label(i), value: p.value })),
    marks,
    spoken: `${m.name} ${shown.map((p, i) => `${label(i)} ${formatMarket(m.key, p.value)}`).join(", ")}. 한 주 ${c.spoken}.`,
  };
}

/** 스파크라인 크기(viewBox) */
const SW = 84;
const SH = 30;

/**
 * 지난주 경제는(2026-11-25): 지표마다 앞 주(회색 선)와 지난주(검정 선), 지난주 마지막 값과 한 주 등락, 왜 움직였는지 한 줄(Gemini가 소식에서 찾은 것, 못 찾으면 없음).
 * 6안: 제목은 그 한 줄 총평(없으면 '지난주 경제는'), 지표는 카드 없이 줄로. 등락은 ▲▼ 글자와 함께 오르면 빨강·내리면 파랑(증권 관례, 2026-11-25 사용자 6안).
 * 판단 색(부담 빨강·긍정 파랑)과 같은 색이지만 이 칸의 숫자는 시장 방향이고 ▲▼가 같이 있어 섞이지 않는다
 */
function EconomyBlock({ markets, start, economy }: { markets: ReportMarket[]; start: string; economy: ReportData["digest"]["economy"] }) {
  const rows = markets.flatMap((m) => {
    const change = marketChange(m, start);
    if (!change) return [];
    const vals = m.points.map((p) => p.value);
    const min = Math.min(...vals);
    const span = Math.max(...vals) - min || 1;
    const x = (i: number) => 3 + (i * (SW - 6)) / Math.max(1, vals.length - 1);
    const y = (v: number) => 4 + (1 - (v - min) / span) * (SH - 8);
    const first = m.points.findIndex((p) => p.date >= start);
    const seg = (a: number, b: number) => `M${vals.slice(a, b + 1).map((v, k) => `${x(a + k).toFixed(1)} ${y(v).toFixed(1)}`).join(" L")}`;
    return [
      {
        m,
        change,
        c: formatChange(m.key, change),
        before: first > 0 ? seg(0, first) : null,
        now: seg(Math.max(0, first), vals.length - 1),
        end: { x: x(vals.length - 1), y: y(vals.at(-1)!) },
        note: economy?.notes.find((n) => n.key === m.key)?.text,
      },
    ];
  });
  if (!rows.length) return null;
  return (
    <ReportBlock title={economy?.headline || "지난주 경제는"}>
      <p className="-mt-2 text-[13px] font-medium text-sub">지난주 경제, 마지막 거래일 값 기준</p>
      <ul className="mt-2">
        {rows.map(({ m, change, c, before, now, end, note }) => (
          <li key={m.key} className="border-b border-line py-3.5 last:border-b-0">
            <div className="grid grid-cols-[minmax(0,1fr)_5.25rem_auto] items-center gap-3">
              <span className="truncate text-[15px] font-bold">{m.name}</span>
              <svg viewBox={`0 0 ${SW} ${SH}`} className="h-[30px] w-[84px] text-ink" role="img" aria-label={`${m.name} 2주 흐름, 지난주 ${formatMarket(m.key, change.to)}, ${c.spoken}`}>
                {before && <path d={before} fill="none" stroke="var(--color-line-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                <path d={now} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={end.x} cy={end.y} r="3" fill="currentColor" />
              </svg>
              <span className="min-w-[4.5rem] text-right">
                <span className="block text-[16px] font-extrabold tabular-nums">{formatMarket(m.key, change.to)}</span>
                <span className={`block text-[13px] font-bold tabular-nums ${c.arrow === "▲" ? "text-minus" : c.arrow === "▼" ? "text-plus" : "text-sub"}`}>{c.text}</span>
              </span>
            </div>
            {note && <p className="mt-2 text-[14px] font-medium leading-[1.6] text-ink/80">{note}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] font-medium text-sub">작은 선의 회색은 그 전 주, 검정은 지난주예요. 출처: 한국은행 경제통계시스템(ECOS)</p>
    </ReportBlock>
  );
}
