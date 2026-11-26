import { AuthLink } from "@/components/landing/AuthLink";
import { weekLabels } from "@/lib/public-glance";
import type { PublicTopicDigest } from "@/lib/server/public-topics";
import { dayLabel } from "./TopicItem";

// 분야·세부 주제 페이지의 머리 아래 두 부분(2026-11-26 사용자: 서치 콘솔 '크롤링됨 - 색인 안 됨' → 주제 설명과 최근 흐름을 붙이자).
// TopicIntro: 주제마다 다른 설명(lib/public-topic-blurbs.ts) + 맹고가 소식을 모으는 방식 한 줄.
// RecentGlance: 최근 30일 한눈에. 지난 30일 소식 수, 최근 4주 주별 막대(한 색, 숫자 직접 표기, 축 없음), 여러 매체가 다룬 소식 3개.
// 숫자는 DB에 있는 소식을 센 것이고 AI를 부르지 않는다(lib/public-glance.ts). 매체 이름 목록은 페이지 아래 '소식을 모으는 곳'이 맡는다

export function TopicIntro({ blurb }: { blurb: string }) {
  return (
    <>
      <p className="mt-4 text-[16px] font-medium leading-relaxed text-sub md:text-[17px]">{blurb}</p>
      <p className="mt-3 text-[14px] font-semibold text-sub">국내외 매체와 공식 블로그에서 모은 소식을 AI가 요약하고, 모든 소식에 원문 링크를 붙여요.</p>
    </>
  );
}

/** 막대 칸의 높이와 막대 최대 높이(px). 위쪽 남는 자리에 숫자가 앉는다 */
const PLOT_H = 76;
const BAR_MAX = 52;

export function RecentGlance({ name, month }: { name: string; month: NonNullable<PublicTopicDigest["month"]> }) {
  const labels = weekLabels();
  const max = Math.max(...month.weeks, 1);
  return (
    <section aria-labelledby="glance-title" className="mt-8 rounded-2xl bg-snow p-5">
      <h2 id="glance-title" className="text-[18px] font-black tracking-[-0.02em]">
        최근 30일 한눈에
      </h2>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <p>
          <span className="block text-[13px] font-extrabold text-sub">지난 30일 {name} 소식</span>
          <span className="mt-1 block text-[36px] font-black leading-none tracking-[-0.04em] tabular-nums">
            {month.total.toLocaleString("ko-KR")}
            <span className="ml-0.5 text-[18px] tracking-normal">개</span>
          </span>
        </p>

        {/* 주별 소식 수: 막대는 한 색, 숫자를 막대 위에 바로 적는다. 사람이 읽는 순서는 '3주 전 → 최근 7일' */}
        <ul aria-label="주별 소식 수" className="flex w-full items-end sm:w-auto">
          {month.weeks.map((n, i) => (
            <li key={labels[i]} className="flex-1 sm:w-[68px] sm:flex-none">
              <div style={{ height: PLOT_H }} className="flex flex-col items-center justify-end border-b border-line-dark">
                <span className="text-[13px] font-extrabold leading-none tabular-nums">
                  {n}
                  <span className="sr-only">개</span>
                </span>
                <span aria-hidden="true" style={{ height: n ? Math.max(3, Math.round((n / max) * BAR_MAX)) : 0 }} className="mt-1 w-6 rounded-t-[4px] bg-ink" />
              </div>
              <p className="mt-1.5 text-center text-[12px] font-semibold text-sub">{labels[i]}</p>
            </li>
          ))}
        </ul>
      </div>

      {month.top.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[14px] font-extrabold text-sub">가장 많은 매체가 다룬 소식</h3>
          <ol className="mt-1 divide-y divide-line">
            {month.top.map((t) => (
              <li key={t.clusterId} className="relative py-3">
                <AuthLink
                  signedOut={{ href: "/login", label: t.title }}
                  signedIn={{ href: t.href, label: t.title }}
                  className="text-[16px] font-extrabold leading-snug text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:underline"
                />
                <p className="mt-1 text-[13px] font-semibold text-sub">
                  {t.outlets}곳이 다뤘어요 · <time dateTime={t.date}>{dayLabel(t.date)}</time>
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
