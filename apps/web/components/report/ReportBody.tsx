import Link from "next/link";
import type { ReportData, ReportGroup, ReportPeriod } from "@maengo/core/report";
import { IconChevronRight } from "@/components/icons";
import { SECTION_LABEL, sectionOf } from "@maengo/core/sections";
import { articleToken } from "@/lib/server/share-token";

// 주간 리포트 한 편. 위에서부터 총평·숫자 → 맞춤 체크 → 다음 주 지켜볼 것 → 분야별 정리 → 많이 본 분야 → 자주 나온 키워드 → 놓친 주요 소식.
// 숫자·막대는 DB에서 센 값, 총평·맞춤 체크·다음 주 지켜볼 것·분야별 정리·자주 나온 키워드는 Gemini가 쓴 것(pipeline/src/reports.ts). 맹고-문서/리포트.md
// 맞춤 체크(2026-11-11 사용자: 주간 리포트도 맞춤형 인사이트로): 내 맞춤 정보에 이번 주 소식이 무슨 뜻이었는지. 이름은 넣지 않는다

/** 앞 기간 이름(견주는 말에 쓴다) */
const before = (period: ReportPeriod) => (period === "week" ? "지난주" : "");

export function ReportBody({ period, data }: { period: ReportPeriod; data: ReportData }) {
  const { counts, prev, digest, groups, items } = data;
  const missed = data.missed.filter((id) => items[id]);
  return (
    <div className="flex flex-col gap-9">
      <section aria-label="한눈에" className="keep-light rounded-2xl bg-mango px-5 pb-5 pt-5">
        <p className="text-[22px] font-bold leading-snug tracking-[-0.03em] text-balance">{digest.headline}</p>
        <dl className="mt-4 grid grid-cols-4 gap-2">
          <Stat label="받은 소식" now={counts.received} prev={prev?.received} period={period} />
          <Stat label="본 소식" now={counts.consumed} prev={prev?.consumed} period={period} />
          <Stat label="들은 소식" now={counts.listened} prev={prev?.listened} period={period} />
          <Stat label="북마크" now={counts.bookmarked} prev={prev?.bookmarked} period={period} />
        </dl>
      </section>

      <PersonalCheck personal={digest.personal ?? []} items={items} />

      {!!digest.next?.length && (
        <Block title="다음 주 지켜볼 것">
          <ul className="tile flex flex-col gap-1 p-4 sm:p-5">
            {digest.next.map((n) => {
              const id = n.ids.find((x) => items[x]);
              const text = (
                <>
                  <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-mango" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-[16px] font-semibold leading-relaxed">{n.text}</span>
                  {id !== undefined && <IconChevronRight className="mt-1 size-4 shrink-0 text-faint" />}
                </>
              );
              return (
                <li key={n.text}>
                  {id !== undefined ? (
                    <Link href={`/article/${articleToken(id)}`} aria-label={`${n.text}, 근거 소식: ${items[id]!.title}`} className="flex items-start gap-3 py-1.5 no-underline hover:text-mango-deep">
                      {text}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 py-1.5">{text}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      <Block title="분야별로 보면">
        <div className="flex flex-col gap-3">
          {digest.sections.map((s) => {
            const g = groups.find((x) => x.name === s.group);
            return (
              <article key={s.group} className="tile p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="min-w-0 truncate text-[17px] font-bold tracking-[-0.02em]">{s.group}</h3>
                  {g && <span className="shrink-0 text-[13px] font-semibold text-sub tabular-nums">{`${g.received}개 중 ${g.consumed}개 봄`}</span>}
                </div>
                <p className="mt-2 text-[15px] font-medium leading-relaxed">{s.summary}</p>
                <ItemLinks ids={s.ids} items={items} className="mt-3 border-t-2 border-line" />
              </article>
            );
          })}
        </div>
      </Block>

      <Block title="많이 본 분야">
        <GroupBars groups={groups} period={period} hasPrev={!!prev} />
      </Block>

      {/* 자주 나온 키워드: 누르면 보관함에서 그 말로 찾는다. '내 키워드로 넣기'·'이번 주에 넣은 관심사'는 뺐다
          (2026-11-10 개편: 키워드를 고르거나 넣게 하지 않고 맹고가 읽고 듣는 기록으로 맞춘다) */}
      {digest.keywords.length > 0 && (
        <Block title="자주 나온 키워드">
          <ul className="flex flex-col gap-2">
            {digest.keywords.map((k) => {
              const first = k.ids.map((id) => items[id]).find(Boolean);
              return (
                <li key={k.word}>
                  <Link href={`/library?q=${encodeURIComponent(k.word)}`} className="tile flex items-center gap-3 py-3 pl-4 pr-3 no-underline hover:bg-snow">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-bold tracking-[-0.01em]">#{k.word}</span>
                      {first && <span className="mt-0.5 block truncate text-[13px] font-medium text-sub">{first.title}</span>}
                    </span>
                    <IconChevronRight className="size-5 shrink-0 text-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Block>
      )}

      {missed.length > 0 && (
        <Block title="놓친 주요 소식">
          <ul className="flex flex-col gap-2">
            {missed.map((id) => (
              <li key={id}>
                <Link href={`/article/${articleToken(id)}`} className="tile flex items-center gap-3 p-4 no-underline hover:bg-snow">
                  {/* 제목 먼저, 분야는 아래(보관함 목록과 같은 순서). 분야는 8개 분야 이름(글 종류 → 분야) */}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[16px] font-bold leading-snug tracking-[-0.02em]">{items[id]!.title}</span>
                    {sectionOf({ category: items[id]!.category }) && (
                      <span className="mt-1 block text-[12px] font-semibold text-sub">{SECTION_LABEL[sectionOf({ category: items[id]!.category })!]}</span>
                    )}
                  </span>
                  <IconChevronRight className="size-5 shrink-0 text-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

/** 맞춤 체크: 내 맞춤 정보로 짚은 이번 주(남색 블록, 위 총평의 망고색과 나눈다). 근거 소식을 누르면 글 화면 */
function PersonalCheck({ personal, items }: { personal: NonNullable<ReportData["digest"]["personal"]>; items: ReportData["items"] }) {
  if (!personal.length) return null;
  return (
    <section aria-labelledby="report-match" className="keep-light rounded-[24px] bg-[#1F2340] px-3 pb-3 pt-4 text-white">
      <h2 id="report-match" className="px-1.5 text-[17px] font-bold tracking-[-0.02em] text-mango">
        맞춤 체크
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {personal.map((x) => (
          <article key={x.title} className="rounded-[18px] bg-white px-4 pb-2 pt-3.5 text-[#1F2340]">
            <span className="inline-flex rounded-full bg-mango px-2.5 py-1 text-[12px] font-bold">{x.about}</span>
            <h3 className="mt-2 text-[17px] font-bold leading-snug tracking-[-0.025em]">{x.title}</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-[#1F2340]/80">{x.text}</p>
            <ItemLinks ids={x.ids} items={items} className="mt-2 border-t-2 border-[#1F2340]/10" />
          </article>
        ))}
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-[20px] font-bold tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

/** 숫자 칸. 앞 기간이 있으면 차이(+3 / −2)를 아래에 */
function Stat({ label, now, prev, period }: { label: string; now: number; prev: number | undefined; period: ReportPeriod }) {
  const diff = prev === undefined ? null : now - prev;
  return (
    <div className="rounded-xl bg-white/70 px-1 py-2.5 text-center">
      <dt className="text-[12px] font-semibold text-ink/70">{label}</dt>
      <dd className="mt-0.5 font-round text-[22px] font-bold leading-none tabular-nums">{now}</dd>
      {diff !== null && (
        <dd className={`mt-1 text-[12px] font-semibold tabular-nums ${diff > 0 ? "text-leaf-dark" : "text-ink/50"}`}>
          <span aria-hidden="true">{diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : "±0"}</span>
          <span className="sr-only">{diff === 0 ? `${before(period)}와 같아요` : `${before(period)}보다 ${Math.abs(diff)}개 ${diff > 0 ? "더" : "덜"}`}</span>
        </dd>
      )}
    </div>
  );
}

/** 분야마다 받은 수(막대 길이)와 그중 본 수(채운 부분). 본 수 많은 순 */
function GroupBars({ groups, period, hasPrev }: { groups: ReportGroup[]; period: ReportPeriod; hasPrev: boolean }) {
  const rows = [...groups].sort((a, b) => b.consumed - a.consumed || b.received - a.received);
  const max = Math.max(1, ...rows.map((g) => g.received));
  // 앞 기간보다 가장 많이 늘어난 분야(3개 넘게 늘었을 때만 한 줄로)
  const up = hasPrev ? [...rows].sort((a, b) => b.consumed - b.prevConsumed - (a.consumed - a.prevConsumed))[0] : undefined;
  const upBy = up ? up.consumed - up.prevConsumed : 0;
  return (
    <div className="tile p-4 sm:p-5">
      <ul className="flex flex-col gap-3">
        {rows.map((g) => (
          <li key={g.id} className="grid grid-cols-[minmax(0,6.5rem)_1fr_3.25rem] items-center gap-3">
            <span className="truncate text-[14px] font-semibold">{g.name}</span>
            <span className="h-3 rounded-full bg-snow" aria-hidden="true">
              <span className="block h-full rounded-full bg-mango-tint" style={{ width: `${(g.received / max) * 100}%` }}>
                <span className="block h-full rounded-full bg-mango" style={{ width: `${g.received ? (g.consumed / g.received) * 100 : 0}%` }} />
              </span>
            </span>
            <span className="text-right text-[13px] font-semibold text-sub tabular-nums">
              <span className="text-ink">{g.consumed}</span>/{g.received}
              <span className="sr-only">{`, 받은 ${g.received}개 중 ${g.consumed}개 봄`}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-2 text-[12px] font-bold text-sub">
        <span className="inline-block h-2.5 w-4 rounded-full bg-mango" aria-hidden="true" />본 소식
        <span className="ml-2 inline-block h-2.5 w-4 rounded-full bg-mango-tint" aria-hidden="true" />받은 소식
      </p>
      {up && upBy >= 3 && (
        <p className="mt-3 border-t-2 border-line pt-3 text-[15px] font-bold leading-relaxed">
          {`${up.name} 소식을 ${before(period)}보다 ${upBy}개 더 봤어요.`}
        </p>
      )}
    </div>
  );
}

function ItemLinks({ ids, items, className = "" }: { ids: number[]; items: ReportData["items"]; className?: string }) {
  const shown = ids.filter((id) => items[id]);
  if (!shown.length) return null;
  return (
    <ul className={className}>
      {shown.map((id) => (
        <li key={id} className="border-b-2 border-line last:border-b-0">
          <Link href={`/article/${articleToken(id)}`} className="flex items-center gap-2 py-2.5 text-[14px] font-bold no-underline hover:text-mango-deep">
            <span className="min-w-0 flex-1 truncate">{items[id]!.title}</span>
            <IconChevronRight className="size-4 shrink-0 text-faint" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

