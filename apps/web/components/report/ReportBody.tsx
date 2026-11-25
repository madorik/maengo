import Link from "next/link";
import { formatChange, formatMarket, marketChange, weekPoints, type ReportMarket } from "@maengo/core/markets";
import { dayName, REPORT_TONES, scheduleDate, toneTotals, type ReportData, type ReportPeriod, type ReportTone } from "@maengo/core/report";
import { IconCalendar, IconChevronRight } from "@/components/icons";
import { SECTION_LABEL, sectionOf } from "@maengo/core/sections";
import { articleToken } from "@/lib/server/share-token";
import { ReportAppHint } from "./ReportAppHint";
import { ReportImpact, type ImpactView } from "./ReportImpact";
import { ReportSection, ReportWeek, verdictOf, VerdictFrame, weekLead } from "./parts";

// 주간 리포트 한 편(Premium). 2026-11-26 사용자: '핵심적인 내용이 뭔지 우선순위를 세워 구성해야지, 지금 페이지 가독성이 너무 안 좋다' → 승인한 새 구성, 위에서부터:
// ① 지난주 한 줄과 관심사별 판정(남색 상자, ReportImpact) ② 관심사별로 자세히(관심사 탭 + 카드, ReportImpact) ③ 이번 주 챙겨 볼 일정(digest.next)
// ④ 지난주 시장(markets + digest.economy) ⑤ 놓친 주요 소식 ⑥ 나의 한 주(숫자 네 칸 + 요일별 막대) ⑦ 자주 나온 키워드.
// '분야별 정리'와 '많이 본 분야'는 관심사 카드와 겹쳐 화면에서 뺐다(데이터·생성은 그대로). 큰 소식을 얼마나 챙겼나 막대(weight)도 따로 두지 않고 놓친 주요 소식의 한 줄로 옮겼다.
// 상자는 ①·②(관심사 카드)·나의 한 주 칸에만, 나머지는 얇은 구분선. Free는 ①(총평·판정 개수)·나의 한 주·맛보기만 본다(ReportFree.tsx, 2026-11-19).
// 숫자·막대는 DB에서 센 값, 총평·맞춤 체크·다음 주 지켜볼 것·키워드는 Gemini가 쓴 것(pipeline/src/reports.ts). 맹고-문서/리포트.md
// 예전 형식 리포트(관심사 영향·경제·일정이 없는 것)는 있는 칸만 그린다: 상자는 총평만(맞춤 체크가 있으면 판정 줄 자리에 그 문장들), 없는 칸은 숨김.

/** 일정 글 맨 앞의 날짜('26일 ', '12월 1일 ', '27~28일 목요일 '): 왼쪽 날짜 칸에 있으니 제목에서는 뺀다 */
const LEAD_DATE = /^(?:\d{1,2}\s*월\s*)?\d{1,2}\s*(?:[~\-–]\s*\d{1,2}\s*)?일(?:\s*\(?[월화수목금토일]요일\)?)?\s*/;

/** 'YYYY-MM-DD' → '11월 20일' */
const monthDay = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

export function ReportBody({ period, start, data }: { period: ReportPeriod; start: string; data: ReportData }) {
  const { counts, prev, digest, items } = data;
  const missed = data.missed.filter((id) => items[id]);
  const interests = impactViews(data, start);
  const tones = toneTotals(digest.personal);
  const touched = tones ? tones.minus + tones.plus + tones.watch : 0;
  return (
    <div className="flex flex-col gap-11">
      {interests.length ? (
        <ReportImpact
          headline={digest.headline}
          interests={interests}
          footnote={
            counts.received > 0 && touched > 0 ? (
              <>
                {`받은 소식 ${counts.received}개 중 관심사와 닿은 `}
                <b className="font-extrabold text-ink">{`${touched}개`}</b>를 엮었어요
              </>
            ) : undefined
          }
        />
      ) : (
        <PersonalCheck headline={digest.headline} personal={digest.personal ?? []} items={items} />
      )}

      {!!digest.next?.length && <ScheduleBlock next={digest.next} personal={digest.personal ?? []} items={items} start={start} />}

      {!!data.markets?.length && <MarketBlock markets={data.markets} start={start} economy={digest.economy} />}

      {missed.length > 0 && <MissedBlock ids={missed} items={items} weight={data.weight} />}

      <ReportSection id="report-week" title="나의 한 주" lead={weekLead(counts, data.days)}>
        <ReportWeek period={period} counts={counts} prev={prev} days={data.days} openDays={data.openDays} prevOpenDays={data.prevOpenDays} />
      </ReportSection>

      {digest.keywords.length > 0 && (
        <ReportSection id="report-keywords" title="자주 나온 키워드" lead="지난주 소식에 거듭 나온 말이에요">
          {/* 누르면 보관함에서 그 말로 찾는다. '내 키워드로 넣기'·'이번 주에 넣은 관심사'는 뺐다(2026-11-10 개편: 키워드를 고르거나 넣게 하지 않고 맹고가 읽고 듣는 기록으로 맞춘다).
              소식 번호는 근거 1~3개뿐이라 시안의 '9번' 같은 횟수는 지어낼 수 없어 두지 않는다 */}
          <ul className="mt-3.5 flex flex-wrap gap-2">
            {digest.keywords.map((k) => (
              <li key={k.word}>
                <Link href={`/library?q=${encodeURIComponent(k.word)}`} className="inline-flex h-9 items-center rounded-full border border-line-dark px-3.5 text-[14px] font-bold no-underline hover:bg-snow">
                  {k.word}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[13px] font-medium text-sub">누르면 보관함에서 찾아 줘요</p>
        </ReportSection>
      )}

      {/* 웹 회원에게: 다음 리포트는 앱 알림으로(앱 안·앱을 쓰는 회원에겐 안 보인다) */}
      <ReportAppHint />
    </div>
  );
}

/**
 * 예전 형식(쪽을 나누기 전) 맞춤 체크: 맨 위 상자에서 판정 줄 자리를 그 문장들이 대신한다. 근거 소식을 누르면 글 화면.
 * 맞춤 체크도 없으면 총평만
 */
function PersonalCheck({ headline, personal, items }: { headline: string; personal: NonNullable<ReportData["digest"]["personal"]>; items: ReportData["items"] }) {
  return (
    <VerdictFrame headline={headline} lines={personal.length > 0}>
      {personal.length > 0 && (
        <ul aria-label="맞춤 체크" className="mt-4">
          {personal.map((x) => (
            <li key={x.title} className="border-t border-white/12 py-3.5">
              <p className="text-[16px] font-extrabold tracking-[-0.03em]">{x.about}</p>
              <p className="mt-1 text-[14px] font-medium leading-[1.65] text-white/72">{x.text}</p>
              <ItemLinks ids={x.ids} items={items} className="mt-1" rule="border-white/12" hover="hover:text-mango" />
            </li>
          ))}
        </ul>
      )}
    </VerdictFrame>
  );
}

/** 요일 칸 옆 글자 크기를 맞춘 달력 칸 */
function DateBox({ at }: { at: ReturnType<typeof scheduleDate> }) {
  return (
    <span aria-hidden="true" className="flex h-[58px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-snow">
      {at ? (
        <>
          <span className="text-[11px] font-semibold leading-tight text-sub">{`${at.month}월`}</span>
          <span className="text-[20px] font-extrabold leading-[1.15] tabular-nums">{at.day}</span>
          <span className="text-[11px] font-semibold leading-tight text-sub">{at.weekday}</span>
        </>
      ) : (
        <IconCalendar className="size-6 text-sub" />
      )}
    </span>
  );
}

/**
 * 이번 주 챙겨 볼 일정(digest.next, 소식에 나온 발표·일정·수치). 줄마다 날짜 칸(글에서 읽을 수 있을 때만, 못 읽으면 달력 아이콘) + 할 일 + 근거 소식 제목 + 그 소식이 닿은 관심사 이름.
 * 줄을 누르면 근거 소식 글 화면
 */
function ScheduleBlock({ next, personal, items, start }: { next: NonNullable<ReportData["digest"]["next"]>; personal: NonNullable<ReportData["digest"]["personal"]>; items: ReportData["items"]; start: string }) {
  return (
    <ReportSection id="report-schedule" title="이번 주 챙겨 볼 일정" lead="지난주 소식에 나온 발표와 일정이에요">
      <ul className="mt-2">
        {next.map((n) => {
          const id = n.ids.find((x) => items[x]);
          const at = scheduleDate(n.text, start);
          const task = (at && n.text.replace(LEAD_DATE, "").trim()) || n.text;
          // 이 소식이 닿은 관심사(쪽별 소식 또는 흐름을 바꾼 소식에 들어 있는 것)
          const about = personal
            .filter((p) => n.ids.some((x) => p.ids.includes(x) || REPORT_TONES.some((t) => p.tally?.[t].includes(x))))
            .map((p) => p.about)
            .slice(0, 2);
          const body = (
            <>
              <DateBox at={at} />
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block text-[16px] font-bold leading-[1.4] tracking-[-0.02em]">{task}</span>
                {id !== undefined && <span className="mt-0.5 line-clamp-2 block text-[14px] font-medium leading-[1.5] text-ink/80">{items[id]!.title}</span>}
                {about.length > 0 && <span className="mt-1 block text-[12.5px] font-bold text-mango-deep">{about.join(", ")}</span>}
              </span>
            </>
          );
          return (
            <li key={n.text} className="border-t border-line first:border-t-0">
              {id !== undefined ? (
                <Link href={`/article/${articleToken(id)}`} aria-label={`${n.text}, 근거 소식: ${items[id]!.title}`} className="flex gap-3.5 py-3.5 no-underline">
                  {body}
                </Link>
              ) : (
                <div className="flex gap-3.5 py-3.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </ReportSection>
  );
}

/** 스파크라인 크기(viewBox) */
const SW = 72;
const SH = 26;

/**
 * 지난주 시장(2026-11-25 경제 칸 → 2026-11-26 줄 목록): 지표마다 이름, 작은 선(앞 주 회색 + 지난주 진한 선), 지난주 마지막 값과 한 주 등락, 왜 움직였는지 한 줄(Gemini가 소식에서 찾은 것, 못 찾으면 없음).
 * 섹션 머리 아래 한 줄은 경제 총평(없으면 값 기준). 등락은 ▲▼ 글자와 함께 오르면 빨강 계열·내리면 파랑(증권 관례, 2026-11-25 사용자 6안).
 * 판단 색(부담·긍정)과 같은 색이지만 이 칸의 숫자는 시장 방향이고 ▲▼가 같이 있어 섞이지 않는다
 */
function MarketBlock({ markets, start, economy }: { markets: ReportMarket[]; start: string; economy: ReportData["digest"]["economy"] }) {
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
    <ReportSection id="report-market" title="지난주 시장" lead={economy?.headline || "지난주 마지막 거래일 값과 한 주 등락이에요"}>
      <ul className="mt-1.5">
        {rows.map(({ m, change, c, before, now, end, note }) => (
          <li key={m.key} className="border-t border-line py-4 first:border-t-0">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-[16px] font-bold">{m.name}</span>
              <svg viewBox={`0 0 ${SW} ${SH}`} className="h-[26px] w-[72px] shrink-0 text-ink" role="img" aria-label={`${m.name} 2주 흐름, 지난주 ${formatMarket(m.key, change.to)}, ${c.spoken}`}>
                {before && <path d={before} fill="none" stroke="var(--color-line-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                <path d={now} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={end.x} cy={end.y} r="3" fill="currentColor" />
              </svg>
              <span className="min-w-[5.75rem] text-right">
                <span className="block text-[18px] font-extrabold tracking-[-0.03em] tabular-nums">{formatMarket(m.key, change.to)}</span>
                {/* 등락은 색 없이 ▲▼만(증권 관례 빨강·파랑이 판단 색 — 긍정 파랑·부담 주황 — 과 섞이지 않게, 0061d01 결정) */}
                <span className="mt-px block text-[13px] font-bold tabular-nums text-ink/80">{c.text}</span>
              </span>
            </div>
            {note && <p className="mt-1.5 text-[14px] font-medium leading-[1.6] text-ink/80">{note}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[12.5px] font-medium leading-normal text-sub">마지막 거래일 값 기준, 작은 선의 회색은 그 전 주예요. 출처: 한국은행 경제통계시스템(ECOS)</p>
    </ReportSection>
  );
}

/**
 * 놓친 주요 소식(무게가 큰데 읽지도 듣지도 않은 것, 최대 3개). 2026-11-25 사용자 '뉴스 카드가 촌스럽다': 상자 없이 선으로 나눈 줄, 분야는 제목 위 주황 글자.
 * 소식 사진은 리포트에 담기지 않아(ReportItem) 사진 없이. 큰 소식·눈여겨볼 소식을 얼마나 챙겼는지는 머리 아래 한 줄로(예전엔 따로 막대)
 */
function MissedBlock({ ids, items, weight }: { ids: number[]; items: ReportData["items"]; weight: ReportData["weight"] }) {
  const total = weight ? weight.major.received + weight.notable.received : 0;
  const seen = weight ? weight.major.consumed + weight.notable.consumed : 0;
  const lead = total > 0 ? `중요한 소식 ${total}개 중 ${seen}개를 챙겼어요. 아직 안 본 소식을 모았어요` : "중요한 소식인데 아직 보지 않은 것이에요";
  return (
    <ReportSection id="report-missed" title="놓친 주요 소식" lead={lead}>
      <ul className="mt-1.5">
        {ids.map((id) => {
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
    </ReportSection>
  );
}

/** 근거 소식 줄. rule은 줄 사이 선 색(색 있는 상자 안에서는 상자 색에 맞춘다) */
function ItemLinks({ ids, items, className = "", rule = "border-line", hover = "hover:text-mango-deep" }: { ids: number[]; items: ReportData["items"]; className?: string; rule?: string; hover?: string }) {
  const shown = ids.filter((id) => items[id]);
  if (!shown.length) return null;
  return (
    <ul className={className}>
      {shown.map((id) => (
        <li key={id} className={`border-t first:border-t-0 ${rule}`}>
          <Link href={`/article/${articleToken(id)}`} className={`flex min-h-11 items-center gap-2 py-2 text-[14px] font-bold no-underline ${hover}`}>
            <span className="min-w-0 flex-1 truncate">{items[id]!.title}</span>
            <IconChevronRight className="size-4 shrink-0 text-faint" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * 관심사 두 칸에 넘길 값(쪽을 나눈 맞춤 체크만, 2026-11-25~). 소식 주소는 서버에서만 만들 수 있어 여기서 붙인다.
 * 판정(tone)은 그 관심사에 닿은 소식 수를 쪽마다 센 것 중 많은 쪽(같으면 지켜볼 변수). 줄의 한 줄 이유는 정리한 제목을 그대로 쓴다(새로 쓰지 않는다).
 * 지표 선 그래프: 그 관심사에 가까운 지표(metric)의 그 주 거래일. 흐름을 바꾼 소식이 나온 날을 그날(주말이면 다음 거래일, 없으면 마지막 날) 점으로
 */
function impactViews(data: ReportData, start: string): ImpactView[] {
  const { items } = data;
  const out: ImpactView[] = [];
  for (const p of data.digest.personal ?? []) {
    if (!p.tone || !p.tally) continue;
    const tally = p.tally;
    const toneOf = (id: number): ReportTone | null => REPORT_TONES.find((t) => tally[t].includes(id)) ?? null;
    const news = p.ids
      .filter((id) => items[id])
      .map((id) => ({ id, href: `/article/${articleToken(id)}`, title: items[id]!.title, date: items[id]!.date ?? null, day: items[id]!.date ? dayName(items[id]!.date!) : null, tone: toneOf(id) }));
    const market = p.metric ? data.markets?.find((m) => m.key === p.metric) : undefined;
    const counts = { plus: tally.plus.length, minus: tally.minus.length, watch: tally.watch.length };
    out.push({
      about: p.about,
      tone: verdictOf(counts, p.tone),
      title: p.title,
      text: p.text,
      ...(p.next ? { next: p.next } : {}),
      counts,
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
