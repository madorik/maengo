"use client";

import { IconCheck } from "@/components/icons";
import { useProfile } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { CountUp } from "@/components/ui/CountUp";
import { SLOT_LABEL } from "@maengo/core/sections";
import type { FeedItem } from "@/lib/types";
import type { BriefingInsight } from "@/lib/server/briefing-insight";

/**
 * 오늘 화면 머리(2026-11-11 사용자: '약 15분 · 소식 10개'는 안 중요하다 → 오늘의 흐름 한 줄이 큰 제목, 'OO님에게 맞춤 인사이트'라고 부른다).
 * 흐름이 있으면: 'OO님에게 맞춤 인사이트' → 큰 제목(흐름 한 줄) → '날짜 출근길 · 언론 N곳, 기사 N건에서 골랐어요' → 흐름 카드 → 확인할 것.
 * 못 만들었으면 예전처럼 날짜 줄 → '출근길 브리핑' → 언론·기사 수.
 * 흐름은 서버가 만들어 끼운다(today/page.tsx, lib/server/briefing-insight.ts). 만드는 동안은 같은 모양의 회색 줄(InsightFallback)
 */
export function BriefingHero({ insight }: { insight: BriefingInsight | null }) {
  const { data } = useToday();
  const pm = data.slot === "pm";
  const slotLabel = SLOT_LABEL[data.slot ?? "am"];
  if (!insight) {
    return (
      <>
        <DateLine pm={pm} />
        <h1 id="briefing-title" className="mt-1 text-[26px] font-bold tracking-[-0.035em]">
          {slotLabel} 브리핑
        </h1>
        <Collected pm={pm} />
      </>
    );
  }
  return (
    <>
      <ForYou pm={pm} />
      <h1 id="briefing-title" className="mt-1.5 text-[25px] font-bold leading-[1.3] tracking-[-0.035em] text-balance">
        {insight.headline}
      </h1>
      <Collected pm={pm} withDate />
      <Flows insight={insight} pm={pm} />
    </>
  );
}

/** 'OO님에게 맞춤 인사이트'(이름이 없으면 회원님) */
function ForYou({ pm }: { pm: boolean }) {
  const { displayName } = useProfile();
  const name = displayName?.trim() || "회원";
  return <p className={`text-[13px] font-bold ${pm ? "text-mango" : "text-mango-deep"}`}>{name}님에게 맞춤 인사이트</p>;
}

/** '11월 11일 수요일 출근길'(때를 가리키는 끝말은 떼고 출근길·퇴근길을 붙인다) */
function useDateLabel(): string {
  const { data } = useToday();
  const day = data.greetingDate.replace(/\s*(오전|오후|새벽|아침|점심|낮|저녁|밤)$/, "");
  return `${day} ${SLOT_LABEL[data.slot ?? "am"]}`;
}

function DateLine({ pm }: { pm: boolean }) {
  return <p className={`text-[13px] font-medium ${pm ? "text-white/65" : "text-sub"}`}>{useDateLabel()}</p>;
}

/** 언론 N곳, 기사 N건에서 골랐어요(숫자는 0부터 올라간다, 2026-11-11 사용자). withDate면 앞에 날짜 */
function Collected({ pm, withDate = false }: { pm: boolean; withDate?: boolean }) {
  const { data } = useToday();
  const date = useDateLabel();
  const has = !!data.collected && data.collected.articles > 0;
  if (!has && !withDate) return null;
  return (
    <p className={`mt-1.5 text-[13px] ${pm ? "text-white/65" : "text-sub"}`}>
      {withDate && date}
      {withDate && has && " · "}
      {has && (
        <>
          언론 <CountUp id="today-sources" value={data.collected!.sources} />곳, 기사 <CountUp id="today-articles" value={data.collected!.articles} />건에서 골랐어요.
        </>
      )}
    </p>
  );
}

/** 흐름 하나에 묶인 소식들의 사진(있는 것만, 셋까지). 카드 아래 작은 동그라미로 겹쳐 보인다 */
function photosOf(ids: number[], items: FeedItem[]): string[] {
  return ids
    .map((id) => items.find((i) => i.clusterId === id))
    .map((i) => i?.photo?.url ?? i?.thumbnail ?? "")
    .filter(Boolean)
    .slice(0, 3);
}

/** 카드 바탕을 번갈아(남색·망고·흰색). 퇴근길(남색 바탕)은 망고·반투명·흰색 */
const TONES = {
  am: [
    { card: "bg-[#1F2340] text-white", sub: "text-white/75", count: "text-mango", ring: "ring-[#1F2340]" },
    { card: "bg-mango text-[#1F2340]", sub: "text-[#1F2340]/75", count: "text-[#1F2340]", ring: "ring-mango" },
    { card: "bg-paper text-ink shadow-[0_0_0_1px_var(--color-line)]", sub: "text-sub", count: "text-mango-deep", ring: "ring-paper" },
  ],
  pm: [
    { card: "bg-mango text-[#1F2340]", sub: "text-[#1F2340]/75", count: "text-[#1F2340]", ring: "ring-mango" },
    { card: "bg-white/10 text-white", sub: "text-white/70", count: "text-mango", ring: "ring-[#2B2F4E]" },
    { card: "bg-white text-[#1F2340]", sub: "text-[#1F2340]/70", count: "text-mango-deep", ring: "ring-white" },
  ],
} as const;

/** 소식 카드로 내려가 잠깐 빛낸다(노선·카드 보기 모두 data-cluster) */
function goToStory(id: number) {
  const el = document.querySelector<HTMLElement>(`[data-cluster="${id}"]`);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  el.animate?.([{ backgroundColor: "rgb(255 194 61 / 0.32)" }, { backgroundColor: "rgb(255 194 61 / 0)" }], { duration: 1600, easing: "ease-out", delay: reduce ? 0 : 350 });
}

/**
 * 흐름 카드(2026-11-11 사용자: 회색 상자·노란 막대 목록은 너무 구리다 → 옆으로 넘기는 카드).
 * 사진이 있는 소식이 일부뿐이라 사진에 기대지 않는다: 남색·망고·흰색 바탕에 흐름 이름을 크게, 설명 세 줄, 아래 묶인 소식 사진(있으면 작은 동그라미)과 소식 수. 누르면 그 소식 카드로.
 * 확인할 것은 카드 아래 연한 망고색 줄로 따로
 */
function Flows({ insight, pm }: { insight: BriefingInsight; pm: boolean }) {
  const { data } = useToday();
  return (
    <>
      <ul aria-label="오늘의 흐름" className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {insight.flows.map((f, k) => {
          const tone = TONES[pm ? "pm" : "am"][k % 3]!;
          const photos = photosOf(f.ids, data.items);
          return (
            <li key={f.title} className="w-[80%] max-w-[300px] shrink-0 snap-start">
              <button type="button" onClick={() => goToStory(f.ids[0]!)} className={`flex h-full w-full flex-col rounded-[22px] px-5 pb-4 pt-5 text-left ${tone.card}`}>
                <span className="text-[19px] font-bold leading-[1.3] tracking-[-0.035em] text-balance">{f.title}</span>
                <span className={`mt-2 line-clamp-3 text-[14px] leading-[1.55] ${tone.sub}`}>{f.text}</span>
                <span className="mt-auto flex items-center gap-2 pt-4">
                  {photos.length > 0 && (
                    <span className="flex -space-x-2">
                      {photos.map((src) => (
                        // eslint-disable-next-line @next/next/no-img-element -- 원문 사진 주소(언론사마다 달라 next/image 허용 목록에 넣을 수 없다)
                        <img key={src} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={`size-7 rounded-full object-cover ring-2 ${tone.ring}`} />
                      ))}
                    </span>
                  )}
                  <span className={`text-[13px] font-semibold ${tone.count}`}>소식 {f.ids.length}개</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {insight.checks.map((c) => (
        <button
          key={c.text}
          type="button"
          onClick={() => goToStory(c.id)}
          className={`-mx-1.5 mt-3 flex w-[calc(100%+0.75rem)] items-start gap-2.5 rounded-2xl px-4 py-3 text-left text-[14px] font-medium leading-relaxed ${pm ? "bg-mango/15 text-white" : "bg-mango-tint text-ink"}`}
        >
          <IconCheck className={`mt-[3px] size-4 shrink-0 [stroke-width:3] ${pm ? "text-mango" : "text-mango-deep"}`} />
          <span>{c.text}</span>
        </button>
      ))}
    </>
  );
}

/** 흐름을 만드는 동안(처음 열 때 몇 초): 큰 제목·흐름 상자 자리는 회색 줄, 언론·기사 수는 그대로. 높이를 미리 잡아 다 됐을 때 덜 밀린다 */
export function InsightFallback() {
  const { data } = useToday();
  const pm = data.slot === "pm";
  const bar = `rounded-full motion-safe:animate-pulse ${pm ? "bg-white/15" : "bg-line"}`;
  return (
    <>
      <ForYou pm={pm} />
      <div aria-hidden="true" className="mt-2.5">
        <div className={`h-6 w-11/12 ${bar}`} />
        <div className={`mt-2 h-6 w-3/5 ${bar}`} />
      </div>
      <h1 id="briefing-title" className="sr-only">
        {SLOT_LABEL[data.slot ?? "am"]} 브리핑
      </h1>
      <Collected pm={pm} withDate />
      <div aria-hidden="true" className="-mx-5 mt-4 flex gap-3 overflow-hidden px-5">
        {[0, 1].map((k) => (
          <div key={k} className={`w-[80%] max-w-[300px] shrink-0 rounded-[22px] px-5 pb-5 pt-5 ${pm ? "bg-white/10" : "bg-snow"}`}>
            <div className={`h-5 w-3/5 ${bar}`} />
            <div className={`mt-3 h-3 w-full ${bar}`} />
            <div className={`mt-2 h-3 w-11/12 ${bar}`} />
            <div className={`mt-2 h-3 w-3/5 ${bar}`} />
            <div className={`mt-6 h-3 w-1/4 ${bar}`} />
          </div>
        ))}
      </div>
    </>
  );
}
