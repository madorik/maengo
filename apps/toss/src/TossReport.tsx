import type { CategoryId } from "@maengo/core/categories";
import type { ReportDigest } from "@maengo/core/report";
import { IconChevronRight, IconTrendUp } from "@/components/icons";

// 주간 리포트(토스 공통판). 앱 주간 리포트 화면(app/(app)/(main)/report/page.tsx·components/report/ReportBody.tsx)과 같은 모양.
// 토스판은 로그인이 없어 '내가 본·들은 수', 맞춤 체크, 놓친 주요 소식, 앱 알림 안내는 없고, 숫자는 그 주 토스판 분야 소식 수.
// 소식을 누르면 원문을 기기 브라우저로 연다(main.tsx)

export interface TossReportData {
  start: string;
  title: string;
  range: string;
  digest: ReportDigest;
  total: number;
  groups: { id: string; name: string; count: number }[];
  items: Record<string, { title: string; category: CategoryId; url: string }>;
}

/** 오늘 화면의 리포트 입구(앱 오늘 화면의 '지난주 리포트가 나왔어요' 알림과 같은 남색 줄) */
export function ReportEntry({ report, onOpen }: { report: TossReportData; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="keep-light mt-3 flex w-full items-center gap-3 rounded-[20px] bg-[#1F2340] py-2 pl-2 pr-2 text-left text-white"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mango text-[#1F2340]">
        <IconTrendUp className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold tracking-[-0.02em] text-white">지난주 리포트가 나왔어요</span>
        <span className="mt-0.5 block truncate text-[13px] font-medium text-white/70">{report.digest.headline}</span>
      </span>
      <IconChevronRight className="size-5 shrink-0 text-white/50" />
    </button>
  );
}

export function TossReport({ report }: { report: TossReportData }) {
  const { digest, groups, items } = report;
  const top = groups.slice(0, 3);
  return (
    <div className="mx-auto min-h-dvh max-w-[640px] bg-paper px-4 py-6">
      <h1 className="text-[28px] font-bold tracking-[-0.04em]">주간 리포트</h1>
      <div className="mt-5 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-center">
          <span className="block truncate text-[18px] font-bold tracking-[-0.02em]">{report.title}</span>
          <span className="block text-[13px] font-medium text-sub tabular-nums">{report.range}</span>
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-9 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <section aria-label="한눈에" className="keep-light rounded-2xl bg-mango px-5 pb-5 pt-5">
          <p className="text-[13px] font-semibold text-ink/70">AI가 엮은 한 주</p>
          <p className="mt-1 text-[22px] font-bold leading-snug tracking-[-0.03em] text-balance">{digest.headline}</p>
          <dl className="mt-4 grid grid-cols-4 gap-2">
            <Stat label="소식" now={report.total} />
            {top.map((g) => (
              <Stat key={g.id} label={g.name} now={g.count} />
            ))}
          </dl>
        </section>

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
                      <a href={items[id]!.url} aria-label={`${n.text}, 근거 소식: ${items[id]!.title}`} className="flex items-start gap-3 py-1.5 no-underline hover:text-mango-deep">
                        {text}
                      </a>
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
                    {g && <span className="shrink-0 text-[13px] font-semibold text-sub tabular-nums">{`소식 ${g.count}개`}</span>}
                  </div>
                  <p className="mt-2 text-[15px] font-medium leading-relaxed">{s.summary}</p>
                  <ItemLinks ids={s.ids} items={items} className="mt-3 border-t-2 border-line" />
                </article>
              );
            })}
          </div>
        </Block>

        <Block title="많이 다룬 분야">
          <GroupBars groups={groups} />
        </Block>

        {digest.keywords.length > 0 && (
          <Block title="자주 나온 키워드">
            <ul className="flex flex-col gap-2">
              {digest.keywords.map((k) => {
                const id = k.ids.find((x) => items[x]);
                const inner = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-bold tracking-[-0.01em]">#{k.word}</span>
                      {id !== undefined && <span className="mt-0.5 block truncate text-[13px] font-medium text-sub">{items[id]!.title}</span>}
                    </span>
                    {id !== undefined && <IconChevronRight className="size-5 shrink-0 text-faint" />}
                  </>
                );
                return (
                  <li key={k.word}>
                    {id !== undefined ? (
                      <a href={items[id]!.url} className="tile flex items-center gap-3 py-3 pl-4 pr-3 no-underline hover:bg-snow">
                        {inner}
                      </a>
                    ) : (
                      <div className="tile flex items-center gap-3 py-3 pl-4 pr-3">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Block>
        )}

        <p className="text-[13px] leading-relaxed text-sub">AI가 지난주 토스판 분야 소식을 엮어 만든 정리예요. 정확한 내용은 원문에서 확인해 주세요.</p>
      </div>
    </div>
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

function Stat({ label, now }: { label: string; now: number }) {
  return (
    <div className="rounded-xl bg-white/70 px-1 py-2.5 text-center">
      <dt className="truncate px-0.5 text-[12px] font-semibold text-ink/70">{label}</dt>
      <dd className="mt-0.5 font-round text-[22px] font-bold leading-none tabular-nums">{now}</dd>
    </div>
  );
}

/** 분야마다 소식 수(막대 길이). 많은 순 */
function GroupBars({ groups }: { groups: TossReportData["groups"] }) {
  const max = Math.max(1, ...groups.map((g) => g.count));
  return (
    <div className="tile p-4 sm:p-5">
      <ul className="flex flex-col gap-3">
        {groups.map((g) => (
          <li key={g.id} className="grid grid-cols-[minmax(0,6.5rem)_1fr_3.25rem] items-center gap-3">
            <span className="truncate text-[14px] font-semibold">{g.name}</span>
            <span className="h-3 rounded-full bg-snow" aria-hidden="true">
              <span className="block h-full rounded-full bg-mango" style={{ width: `${(g.count / max) * 100}%` }} />
            </span>
            <span className="text-right text-[13px] font-semibold text-ink tabular-nums">{g.count}개</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemLinks({ ids, items, className = "" }: { ids: number[]; items: TossReportData["items"]; className?: string }) {
  const shown = ids.filter((id) => items[id]);
  if (!shown.length) return null;
  return (
    <ul className={className}>
      {shown.map((id) => (
        <li key={id} className="border-b-2 border-line last:border-b-0">
          <a href={items[id]!.url} className="flex items-center gap-2 py-2.5 text-[14px] font-bold no-underline hover:text-mango-deep">
            <span className="min-w-0 flex-1 truncate">{items[id]!.title}</span>
            <IconChevronRight className="size-4 shrink-0 text-faint" />
          </a>
        </li>
      ))}
    </ul>
  );
}
