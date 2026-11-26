"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { IconChevronRight, IconPlay } from "@/components/icons";
import { MangoIcon } from "@/components/MangoIcon";
import { ToneIcon } from "@/components/ui/ToneIcon";
import { AskChat, type AskTarget } from "@/components/article/AskChat";
import { AiMark } from "@/components/ui/AiMark";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useCallName } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { PhotoImg } from "@/components/ui/PhotoImg";
import { Sheet } from "@/components/ui/Sheet";
import { SECTION_LABEL, isSection } from "@maengo/core/sections";
import { SLOT_LABEL } from "@maengo/core/sections";
import type { FeedItem } from "@/lib/types";
import type { BriefingInsight, InsightTone } from "@/lib/server/briefing-insight";
import { SEEN_MIN } from "@/lib/insight-rules";
import { alsoOf, figureText, pointsOf, tabLabels, whoOf } from "@/lib/insight-card";
import { track } from "@/lib/analytics";

/**
 * 오늘 화면의 인사이트 두 조각. 서버가 흐름을 만들어 끼운다(today/page.tsx, lib/server/briefing-insight.ts).
 * - InsightHead: 머리. 작은 줄 '출근길 브리핑, 11월 26일 수요일' 아래 인사이트 한 줄(insight.headline)이 굵은 제목(주황 형광펜),
 *   그 아래 제목의 근거 사실 한 줄(성격 알약 + 숫자 든 사실, lead). 인사이트가 없거나 만드는 중이면 '출근길 브리핑'과 '날짜, 소식 n개' 한 줄. 시간('8분')은 적지 않는다.
 * - InsightFlows: '오늘의 흐름'. 흐름 카드를 옆으로 넘긴다(2026-11-26 시안 C안, 사용자: 사진·제목만 있는 카드는 다른 뉴스 앱과 다를 게 없다,
 *   핵심 요약 카드는 좌우로 넘기고 이미지는 잘 보이게, 재생 버튼은 뺀다): 위쪽 큰 사진에 소식 수·흐름 제목 → 핵심 요약 두 줄 →
 *   '국내 주식에 부담 요인' + 영향 한 문장(같은 흐름이 다른 관심에도 닿으면 한 줄 더). 카드를 누르면 흐름 상세 시트. 만드는 동안은 같은 자리에 진행 카드(InsightFallback).
 * 'OO님에게 맞춤 인사이트' 꼬리표·맞춤 체크 칸(MatchCheck)은 없다. 맞춤 체크는 흐름 상세 시트 아래쪽의 '챙겨 볼 것'에.
 * 언론 N곳·기사 N건은 보여 주지 않는다(2026-11-12 사용자: 날짜만)
 */
export function InsightHead({
  headline,
  lead = null,
  failed = false,
}: {
  /** 인사이트 한 줄. 없으면(못 만들었거나 만드는 중) 제목만 */
  headline: string | null;
  /** 제목 아래 줄: 제목의 근거 사실과 성격(형식 13부터) */
  lead?: BriefingInsight["lead"] | null;
  /** 소식은 있는데 만들지 못했다(모델 오류·키 없음). 다시 열면 다시 만든다 */
  failed?: boolean;
}) {
  const { data } = useToday();
  const name = useCallName();
  const slotLabel = SLOT_LABEL[data.slot ?? "am"];
  // 인사 날짜 끝의 때(아침·저녁 등)는 떼고 출근길·퇴근길을 붙인다(저녁에 출근길 브리핑을 보면 "저녁 출근길"이 되지 않게)
  const day = data.greetingDate.replace(/\s*(오전|오후|새벽|아침|점심|낮|저녁|밤)$/, "");
  if (headline) {
    return (
      <>
        <p className="text-[14px] font-medium text-sub">
          {slotLabel} 브리핑, {day}
        </p>
        {/* 주황 형광펜을 글자 아래쪽에 줄마다 긋는다(globals.css insight-mark, 2026-11-26 사용자: 지난번처럼 형광펜 밑줄).
            줄은 띄어쓰기에서만 바꾸고(break-keep) 두 줄 길이를 고르게(text-balance) — 사용자: 줄바꿈이 자연스러워야 */}
        <h1 id="briefing-title" className="mt-1 break-keep text-[22px] font-extrabold leading-[1.4] tracking-[-0.04em] text-balance">
          <span className="insight-mark">{callName(headline, name)}</span>
        </h1>
        {/* 제목이 무엇에 근거했는지(2026-11-26 사용자: 핵심 요약과 나한테 어떤 영향인지가 보여야 다른 뉴스 앱과 다르다) */}
        {lead?.fact && (
          <p className="mt-2.5 break-keep text-[15px] font-medium leading-[1.65] text-ink/85">
            <ToneChip tone={lead.tone} className="mr-1.5 align-[1px]" />
            {lead.fact}
          </p>
        )}
      </>
    );
  }
  const count = data.items.length;
  return (
    <>
      <h1 id="briefing-title" className="text-[24px] font-extrabold tracking-[-0.04em]">
        {slotLabel} 브리핑
      </h1>
      <p className="mt-1 text-[14px] font-medium text-sub">
        {day}
        {count > 0 && `, 소식 ${count}개`}
      </p>
      {failed && (
        <p role="status" className="mt-1.5 text-[14px] font-medium leading-snug text-sub">
          오늘의 인사이트를 만들지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      )}
    </>
  );
}

/** AI가 쓴 글에 남은 'OO님'·'회원님'을 프로필 이름으로(이름 없는 계정(운영엔 없다)만 '회원님') */
export function callName(s: string, name: string | null): string {
  return s.replace(/(?:OO|○○|회원)님/g, name ? `${name}님` : "회원님");
}

/**
 * AI가 쓴 글에 남은 'OO님'·'회원님'을 프로필 이름으로(형식 4부터는 AI가 부르지 않는다. 그 전에 만든 글이 다시 만들지 못해 남았을 때만).
 * 이름은 Gemini에 보내지 않는다(개인정보 처리방침 5조)
 */
function withName(insight: BriefingInsight, name: string | null): BriefingInsight {
  const n = (s: string) => callName(s, name);
  return {
    ...insight,
    headline: n(insight.headline),
    // 꼬리표에 호칭이 들어가면('주식하는 당신') 꼬리표를 숨긴다(AI가 부르지 말라는 말을 어길 때)
    flows: insight.flows.map((f) => ({ ...f, title: n(f.title), text: n(f.text), tag: f.tag && !/당신|님/.test(f.tag) ? f.tag : "", why: f.why && n(f.why), watch: f.watch?.map(n) })),
    checks: insight.checks.map((c) => ({ ...c, text: n(c.text) })),
    personal: insight.personal?.map((x) => ({ ...x, title: n(x.title), text: n(x.text) })),
  };
}

/** 흐름 하나에 묶인 소식의 사진(있는 것만). 첫 소식 사진이 카드 바탕이 되고, 없으면 다음 소식 사진을 쓴다 */
function photosOf(ids: number[], items: FeedItem[]): string[] {
  return ids
    .map((id) => items.find((i) => i.clusterId === id))
    .map((i) => i?.photo?.url ?? i?.thumbnail ?? "")
    .filter(Boolean);
}

/** 카드 줄의 가장자리(머리 글자와 같은 줄)와 카드 사이 간격. 카드 너비는 줄 너비에서 30px을 빼서 다음 카드가 40px쯤 보이게(넘길 수 있다는 표시) */
const EDGE = 22;
const GAP = 12;

/**
 * 오늘의 흐름(2026-11-26 시안 E안, 사용자: 더 임팩트 있게): '오늘의 흐름' + 오른쪽 '전체 보기'(지금 보는 카드의 흐름 상세 시트)
 * → 관심 탭('⚠ 국내 주식'·'👁 내 집 마련': 흐름마다 짚는 관심과 성격. 넘기기 전에 내 관심사 어디에 어떤 영향인지 한눈에, 누르면 그 카드로. 예전 점 자리)
 * → 흐름 카드를 옆으로 넘긴다(scroll-snap, 넘기면 탭도 따라 바뀐다).
 * 카드를 누르면 흐름 상세 시트(2026-11-11 사용자: 누르면 상세를 볼 수 있어야 한다). 카드에 재생 버튼은 없다(2026-11-26 사용자) — 듣기는 떠 있는 플레이어와 흐름 상세에서
 */
export function InsightFlows({
  insight: made,
  personalOff = false,
}: {
  insight: BriefingInsight;
  /** 설정에서 맞춤 인사이트를 껐다(챙겨 볼 것이 비는 게 정상이라 읽을수록 좋아진다는 안내를 하지 않는다) */
  personalOff?: boolean;
}) {
  const name = useCallName();
  const insight = withName(made, name);
  /** 열어 본 흐름(상세 시트) */
  const [open, setOpen] = useState<number | null>(null);
  /** 지금 보이는 카드 */
  const [at, setAt] = useState(0);
  const scroller = useRef<HTMLUListElement>(null);
  const count = insight.flows.length;
  if (!count) return null;
  const opened = open === null ? null : insight.flows[open];
  const tabs = tabLabels(insight.flows);
  /** 카드 한 장 넘기는 거리 */
  const step = (el: HTMLElement) => ((el.children[1] as HTMLElement | undefined)?.offsetLeft ?? el.clientWidth) - ((el.children[0] as HTMLElement | undefined)?.offsetLeft ?? 0);
  const go = (k: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: k * step(el), behavior: "smooth" });
  };
  return (
    <section aria-labelledby="flows-title" className="mt-4">
      <div className="flex min-h-11 items-center justify-between gap-2 px-1.5">
        <h2 id="flows-title" className="text-[20px] font-extrabold tracking-[-0.04em]">
          오늘의 흐름
        </h2>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(at)}
          className="inline-flex min-h-11 items-center text-[14px] font-semibold text-sub underline underline-offset-[3px]"
        >
          전체 보기
        </button>
      </div>
      {count > 1 && (
        <div
          role="group"
          aria-label="오늘의 흐름 고르기"
          style={{ paddingInline: EDGE }}
          className="-mx-4 mt-1 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {insight.flows.map((f, k) => {
            const on = k === at;
            const tone = f.effect && f.tone ? f.tone : null;
            return (
              <button
                key={f.title}
                type="button"
                aria-pressed={on}
                onClick={() => go(k)}
                className={`inline-flex h-9 max-w-[200px] shrink-0 items-center gap-1.5 rounded-full border text-[14px] tracking-[-0.02em] ${on ? "border-ink bg-ink font-extrabold text-paper" : "border-line-dark font-semibold text-ink"} ${tone ? "pl-3 pr-3.5" : "px-3.5"}`}
              >
                {tone && <ToneIcon tone={tone} className={`size-[15px] shrink-0 ${on ? "" : VERDICT[tone].text}`} />}
                <span className="truncate">{tabs[k]}</span>
              </button>
            );
          })}
        </div>
      )}
      <ul
        ref={scroller}
        aria-label="오늘의 흐름 카드"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / Math.max(1, step(el))))));
        }}
        style={{ paddingInline: EDGE, scrollPaddingInline: EDGE, columnGap: GAP }}
        className={`-mx-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${count > 1 ? "mt-3" : "mt-1"}`}
      >
        {insight.flows.map((f, k) => (
          <FlowCard key={f.title} flow={f} personal={insight.personal} onOpen={() => setOpen(k)} />
        ))}
      </ul>
      <Sheet title={opened?.title ?? ""} open={!!opened} onClose={() => setOpen(null)}>
        {opened && open !== null && <FlowDetail key={open} flow={opened} index={open} care={careOf(insight, open, personalOff, name)} onClose={() => setOpen(null)} />}
      </Sheet>
    </section>
  );
}

/**
 * 흐름 카드 한 장(2026-11-26 시안 E안, 사용자: 오늘의 흐름을 더 임팩트 있게). 카드 전체가 흐름 상세 시트 버튼.
 * ① 위쪽 큰 사진(228px, 이미지가 잘 보여야 눈이 간다). 글자는 사진 위라 밝기 설정과 상관없이 흰 글자, 사진이 없으면 남색 바탕.
 *    - 오른쪽 위: 흰 알약 '⚠ 국내 주식에 부담 요인'(영향이 있을 때, 2026-11-26 사용자: 라벨은 오른쪽으로), 같은 흐름이 다른 관심에도 닿으면 그 아래 작은 알약 하나 더
 *    - 아래: 핵심 숫자가 있으면(형식 15) 흐름 제목(작게) + 큰 숫자 '−4.6%' + 이름 '코스피 장중', 없으면 '소식 n개' + 흐름 제목(크게)
 * ② 영향 한 문장(굵게) ③ 핵심 요약 두 줄(points, 예전 형식은 사실 + 설명 첫 문장) ④ '자세히 보기'.
 * 카드 높이는 줄에서 가장 긴 카드에 맞추고(늘어남), 남는 자리는 요약과 '자세히 보기' 사이로 가서 '자세히 보기' 줄이 카드마다 같은 높이에 온다
 */
function FlowCard({ flow, personal, onOpen }: { flow: BriefingInsight["flows"][number]; personal: BriefingInsight["personal"]; onOpen: () => void }) {
  const { data } = useToday();
  const photo = photosOf(flow.ids, data.items)[0];
  const tone: InsightTone | null = flow.effect && flow.tone ? flow.tone : null;
  const points = pointsOf(flow);
  const who = whoOf(flow.links);
  const also = tone ? alsoOf(flow, who, personal) : null;
  const figure = flow.figure ? { value: figureText(flow.figure.value), label: flow.figure.label } : null;
  return (
    <li className="flex w-[calc(100%-30px)] max-w-[360px] shrink-0 snap-start">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={onOpen}
        className="flex w-full flex-col overflow-hidden rounded-[22px] border border-line bg-paper text-left active:scale-[0.99] motion-reduce:active:scale-100"
      >
        <span className="relative block h-[228px] w-full shrink-0 bg-[#1F2340]">
          {photo && <PhotoImg src={photo} size="card" className="absolute inset-0 size-full" />}
          {/* 위(알약)와 아래(숫자·제목)만 어둡게, 가운데는 사진이 그대로 보이게 */}
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,13,16,0.32)_0%,rgba(12,13,16,0)_26%,rgba(12,13,16,0.1)_44%,rgba(12,13,16,0.86)_100%)]"
          />
          {tone && (
            <span className="absolute inset-x-3.5 top-3.5 flex flex-col items-end gap-1.5">
              <TonePill tone={tone} who={who} />
              {also && <TonePill tone={also.tone} who={also.who} small />}
            </span>
          )}
          <span className="absolute inset-x-4 bottom-3.5 block text-white">
            {figure ? (
              <>
                <span className="block truncate text-[13px] font-bold text-white/85">{flow.title}</span>
                <span className="mt-0.5 flex items-baseline gap-2">
                  <span className={`shrink-0 font-extrabold leading-[1.1] tracking-[-0.04em] tabular-nums ${figure.value.length > 6 ? "text-[36px]" : "text-[46px]"}`}>{figure.value}</span>
                  <span className="min-w-0 truncate text-[14px] font-bold text-white/85">{figure.label}</span>
                </span>
              </>
            ) : (
              <>
                <span className="block text-[13px] font-bold text-white/85">소식 {flow.ids.length}개</span>
                <span className="mt-0.5 line-clamp-2 block break-keep text-[22px] font-extrabold leading-[1.32] tracking-[-0.045em]">{flow.title}</span>
              </>
            )}
          </span>
        </span>
        <span className="flex flex-1 flex-col px-4 pt-3.5">
          {flow.effect && <span className="block break-keep text-[17px] font-extrabold leading-[1.42] tracking-[-0.035em] text-balance">{flow.effect}</span>}
          {points.length > 0 && (
            <span className={`flex flex-col gap-[3px] ${flow.effect ? "mt-2" : ""}`}>
              {points.map((t) => (
                <span key={t} className="flex gap-2 text-[14px] font-medium leading-[1.5] tracking-[-0.02em] text-ink/75">
                  <span aria-hidden="true" className="mt-[9px] size-1 shrink-0 rounded-full bg-sub" />
                  <span className="line-clamp-2 break-keep">{t}</span>
                </span>
              ))}
            </span>
          )}
          <span aria-hidden="true" className="min-h-2 flex-1" />
          <span className="flex h-11 items-center gap-0.5 text-[14px] font-bold text-sub">
            자세히 보기
            <IconChevronRight className="size-4" />
          </span>
        </span>
      </button>
    </li>
  );
}

/** 사진 위 흰 알약 '⚠ 국내 주식에 부담 요인'. 흰 바탕이라 어두운 화면에서도 밝은 화면의 판정 색(keep-light). small은 둘째 관심 */
function TonePill({ tone, who, small = false }: { tone: InsightTone; who: string; small?: boolean }) {
  return (
    <span
      className={`keep-light inline-flex max-w-full items-center gap-[5px] rounded-full font-extrabold text-[#1F2340] shadow-[0_2px_10px_rgba(12,13,16,0.18)] ${small ? "h-[26px] bg-white/92 pl-[9px] pr-[11px] text-[12.5px]" : "h-[30px] bg-white pl-2.5 pr-3 text-[13px]"}`}
    >
      <ToneIcon tone={tone} className={`shrink-0 ${small ? "size-[13px]" : "size-3.5"} ${VERDICT[tone].text}`} />
      <span className="truncate">
        {who && `${who}에 `}
        <span className={VERDICT[tone].text}>{TONE_LABEL[tone]}</span>
      </span>
    </span>
  );
}

/** 챙겨 볼 것(옛 맞춤 체크, 2026-11-26 홈에서 시트 아래쪽으로): 이 흐름의 소식에 닿는 맞춤 체크·할 일, 못 만들었을 때의 안내 */
interface Care {
  personal: NonNullable<BriefingInsight["personal"]>;
  checks: BriefingInsight["checks"];
  /** 비었거나 읽은 소식이 적을 때 왜인지와 어떻게 하면 좋아지는지(첫 흐름 시트에만) */
  hint: { title: string | null; text: string } | null;
}

/**
 * 맞춤 체크(2026-11-11 사용자: 사용자 맞춤 체크 항목이어야 한다)와 생활 속 할 일을 흐름마다 나눈다: 그 흐름의 소식(id)에 닿는 것만.
 * 어느 흐름에도 닿지 않는 것은 첫 흐름 시트로(잃지 않게). 맞춤 체크가 비었거나 읽은 소식이 적으면 왜인지와 어떻게 하면 좋아지는지 알린다
 * (2026-11-13 사용자: '이전에 읽던 소식이 아직 없다', '많이 읽을수록 분석을 잘해 준다'). 제목 아래에서 이미 '오늘은 맞춤 소식이 없어요'를 말한 형식 13은 또 말하지 않는다
 */
function careOf(insight: BriefingInsight, k: number, personalOff: boolean, name: string | null): Care {
  const mine = (id: number) => insight.flows[k]?.ids.includes(id) || (k === 0 && !insight.flows.some((f) => f.ids.includes(id)));
  const all = insight.personal ?? [];
  const recent = insight.basis?.recent ?? 0;
  const noted = !!insight.lead && !insight.lead.about;
  const hint = !personalOff && !noted && (!all.length || recent < SEEN_MIN);
  return {
    personal: all.filter((x) => mine(x.id)),
    checks: insight.checks.slice(0, 1).filter((c) => mine(c.id)),
    hint:
      hint && k === 0
        ? {
            title: all.length ? null : recent === 0 ? "아직 읽은 소식이 없어서 챙겨 볼 것을 짚지 못했어요" : "오늘은 챙겨 볼 것으로 짚을 소식이 없어요",
            text: all.length ? "소식을 많이 읽을수록 챙겨 볼 것이 더 정확해져요." : `소식을 많이 읽고 들을수록 ${name ? `${name}님에게` : "나에게"} 맞는 인사이트를 더 정확하게 분석해 드려요.`,
          }
        : null,
  };
}

/** 영향의 성격 표시(2026-11-13 사용자: 신뢰도 있는 말투 → 차분한 분석 용어) */
const TONE_LABEL: Record<InsightTone, string> = { plus: "긍정 요인", minus: "부담 요인", watch: "지켜볼 변수" };

/** 성격 배지(긍정 요인 파랑, 부담 요인 주황, 지켜볼 변수 빨강) */
function ToneChip({ tone, className = "" }: { tone: InsightTone; className?: string }) {
  const cls = tone === "plus" ? "bg-plus-tint text-plus" : tone === "minus" ? "bg-minus-tint text-minus" : "bg-watch-tint text-watch";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${cls} ${className}`}>
      <ToneIcon tone={tone} />
      {TONE_LABEL[tone]}
    </span>
  );
}

/** 묶인 소식의 출처 한 줄: '연합뉴스 마켓 외 3곳 보도, 11월 6일'(언론사 이름 sourceLabel, author는 기자 이름일 때가 많다) */
function sourceLine(items: FeedItem[]): string {
  const names = [...new Set(items.map((i) => i.sourceLabel || i.author).filter(Boolean))].slice(0, 2);
  const total = items.reduce((n, i) => n + Math.max(1, i.sourceCount ?? 1), 0);
  const date = items[0]?.publishedLabel;
  if (!names.length) return "";
  // 가운뎃점으로 이어 붙인 메타 줄 대신 문장으로: '연합뉴스 마켓 외 3곳 보도, 11월 6일'
  const more = total - 1;
  return `${names[0]}${more > 0 ? ` 외 ${more}곳` : ""} 보도${date ? `, ${date}` : ""}`;
}

/**
 * 흐름 상세 물어보기의 추천 질문(AI를 부르지 않고 흐름에서 바로). 글 화면 기본 질문(ASK_CHIPS)처럼 반말.
 * 내 관심 꼬리표('자주 보는 경제', '3일 전 읽은 … 소식')는 문장에 넣으면 어색해서 쓰지 않는다
 */
function flowChips(flow: BriefingInsight["flows"][number]): string[] {
  const tone = flow.effect && flow.tone ? flow.tone : null;
  return [
    tone ? `왜 ${TONE_LABEL[tone]}${tone === "watch" ? "라고" : "이라고"} 봤어?` : "이게 왜 나랑 관련 있어?",
    "앞으로 뭘 지켜보면 돼?",
    "더 쉽게 설명해 줘",
  ];
}

/** 판단 색(2026-11-13 사용자 지정: 긍정 요인 파랑, 부담 요인 주황, 지켜볼 변수 빨강) */
const VERDICT: Record<InsightTone, { text: string; rule: string }> = {
  plus: { text: "text-plus", rule: "border-plus" },
  minus: { text: "text-minus", rule: "border-minus" },
  watch: { text: "text-watch", rule: "border-watch" },
};

/** 조용한 단락: 이름(13px) + 내용. 단락 사이는 얇은 선 */
function Part({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-4">
      <h3 className="text-[13px] font-semibold text-sub">{label}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/**
 * 흐름 상세(시트, 2026-11-11 사용자: 누르면 상세를 볼 수 있어야 한다).
 * 2026-11-13 사용자 여러 번: '임팩트가 없다', '신뢰도 있는 말투로 핵심을', '어떻게 닿나요는 필요 없다',
 * '중요한 핵심 소식이 내가 등록한 관심사와 어떤 연관이고, 앞으로 유의 깊게 볼 것, 나에게 미칠 영향을 분석해야 한다', '디자인 스킬로 개선' →
 * 증권사 리서치 노트처럼 맹고의 판단과 확인된 사실을 나눠 믿을 수 있게:
 * 맨 위 '맹고 분석'(판단 색 굵은 왼쪽 선 + 내 관심 칩 + 판단 낱말 크게 + 나에게 미칠 영향 한 문장) — 눈에 띄는 건 이것 하나 →
 * 확인된 사실(숫자 그대로, 보도 언론·날짜) → 왜 나와 관련 있나요(관심과의 연결·읽던 소식) → 다음에 확인할 것 → 배경(흐리게) → 관련 소식 → 듣기.
 * 번호(①②③)는 순서가 아니라서 뺐다. 판단이 없는 예전 형식은 '왜'를 영향 자리에.
 * 2026-11-14 사용자 '인사이트에도 물어보기 기능 넣어줘': 분석 끝에 '이 분석에 대해 물어보기' → 같은 시트가 맹고 AI 대화로 바뀐다(글 화면과 같은 AskChat,
 * 하루 횟수도 같이 센다). 서버가 저장된 이 흐름과 관련 소식을 맥락으로 붙인다(lib/server/ask.ts). 추천 질문은 흐름에서 바로 만든다.
 * 2026-11-26 시안: 홈의 맞춤 체크 칸을 없애고 그 내용을 관련 소식 아래 '챙겨 볼 것'으로 옮겼다(care)
 */
function FlowDetail({ flow, index, care, onClose }: { flow: BriefingInsight["flows"][number]; index: number; care: Care; onClose: () => void }) {
  const { data, listenAccess } = useToday();
  const [asking, setAsking] = useState(false);
  const p = usePlayer();
  const related = flow.ids.map((id) => data.items.find((i) => i.clusterId === id)).filter((i): i is FeedItem => !!i);
  const canListen = p.enabled && related.some((i) => listenAccess(i.clusterId) !== null);
  const sources = sourceLine(related);
  const links = flow.links?.length ? flow.links : flow.tag ? [flow.tag] : [];
  const relation = flow.relation ?? "";
  const effect = flow.effect || flow.why;
  const tone: InsightTone = flow.effect && flow.tone ? flow.tone : "watch";
  const verdict = VERDICT[tone];
  const target: AskTarget = {
    key: `flow.${data.date}.${data.slot ?? "am"}.${index}`,
    ref: { flow: { date: data.date, slot: data.slot ?? "am", index } },
    category: "insight",
    chips: flowChips(flow),
  };
  if (asking) {
    return (
      <div className="pb-2">
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="-ml-1.5 mb-2 inline-flex min-h-11 items-center gap-0.5 rounded-xl px-1.5 text-[14px] font-semibold text-sub hover:bg-snow hover:text-ink"
        >
          <IconChevronRight className="size-4 rotate-180" />
          분석 보기
        </button>
        <AskChat target={target} variant="sheet" />
      </div>
    );
  }
  return (
    <div className="pb-2">
      {/* 맹고 분석: 이 화면에서 눈에 띄는 단 하나 */}
      {effect && (
        <section aria-label="맹고 분석" className={`border-l-4 pl-4 ${verdict.rule}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <p className="text-[13px] font-semibold text-sub">맹고 분석</p>
            {links.map((l) => (
              <span key={l} className="rounded-full bg-snow px-2 py-0.5 text-[12px] font-semibold text-ink">
                {l}
              </span>
            ))}
          </div>
          {flow.effect && flow.tone && (
            <p className={`mt-2 flex items-center gap-1.5 text-[26px] font-bold leading-none tracking-[-0.04em] ${verdict.text}`}>
              <ToneIcon tone={tone} className="size-6" />
              {TONE_LABEL[tone]}
            </p>
          )}
          <p className="mt-2.5 text-[19px] font-semibold leading-[1.5] tracking-[-0.025em] text-ink">{effect}</p>
        </section>
      )}

      <div className="mt-5">
        {(flow.fact || sources) && (
          <Part label="확인된 사실">
            {flow.fact && <p className="text-[17px] font-semibold leading-[1.5] tracking-[-0.02em] text-ink tabular-nums">{flow.fact}</p>}
            {sources && <p className="mt-1 text-[13px] text-sub">{sources}</p>}
          </Part>
        )}
        {(relation || flow.why) && (
          <Part label="왜 나와 관련 있나요">
            {relation && <p className="text-[15px] leading-[1.65] text-ink">{relation}</p>}
            {/* 읽던 소식과의 이어짐은 연결 문장이 없을 때만(같은 말을 두 번 했다) */}
            {!relation && flow.why && flow.effect && <p className="text-[14px] leading-relaxed text-sub">{flow.why}</p>}
          </Part>
        )}
        {!!flow.watch?.length && (
          <Part label="다음에 확인할 것">
            <ul className="flex flex-col gap-1.5">
              {flow.watch.map((w) => (
                <li key={w} className="flex gap-2.5 text-[15px] leading-[1.55] text-ink">
                  <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-mango" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Part>
        )}
        <Part label="배경">
          <p className="text-[14px] leading-[1.7] text-sub">{flow.text}</p>
        </Part>
      </div>
      <button
        type="button"
        onClick={() => {
          setAsking(true);
          track("ask", { category: "insight", action: "open" });
        }}
        className="mb-5 flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-paper py-2.5 pl-2.5 pr-3 text-left hover:bg-snow"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-snow">
          <AiMark className="size-6" />
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-bold tracking-[-0.02em] text-ink">이 분석에 대해 물어보기</span>
        <IconChevronRight className="size-5 shrink-0 text-faint" />
      </button>
      <p className="mt-2 border-t border-line pt-4 text-[13px] font-semibold text-sub">관련 소식 {related.length}개</p>
      <ul className="mt-2 flex flex-col">
        {related.map((i) => {
          const section = i.section && isSection(i.section) ? SECTION_LABEL[i.section] : null;
          const photo = i.photo?.url ?? i.thumbnail;
          return (
            <li key={i.clusterId} className="border-t border-line first:border-t-0">
              <Link href={`/article/${i.token}`} onClick={onClose} className="flex items-start gap-3 py-3 no-underline">
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold text-sub">
                    {section}
                    {(i.sourceCount ?? 0) >= 2 && ` · 언론 ${i.sourceCount}곳`}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{i.title}</span>
                  <span className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-sub">{i.short}</span>
                </span>
                {photo && (
                  <PhotoImg src={photo} className="aspect-[3/2] w-[84px] rounded-xl" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <TakeCare care={care} onClose={onClose} />
      {canListen && related[0] && (
        <button
          type="button"
          onClick={() => {
            // 듣기는 누른 손짓 안에서 건다(iOS). 시트를 닫으면 오늘 화면이 듣는 소식으로 내려간다
            p.playFrom(related[0]!.clusterId);
            onClose();
          }}
          className="btn btn-ink mt-4 w-full gap-2"
        >
          <IconPlay className="size-[18px]" />이 흐름부터 듣기
        </button>
      )}
    </div>
  );
}

/** 챙겨 볼 것: 내 맞춤 정보·읽던 소식으로 짚은 영향(예: 국내 주식 → 금리 인상의 영향) → 생활 속 확인할 것. 모두 없으면 그리지 않는다 */
function TakeCare({ care, onClose }: { care: Care; onClose: () => void }) {
  const { data } = useToday();
  if (!care.personal.length && !care.checks.length && !care.hint) return null;
  const tokenOf = (id: number) => data.items.find((i) => i.clusterId === id)?.token;
  return (
    <Part label="챙겨 볼 것">
      <ul className="-mt-1 divide-y divide-line">
        {care.personal.map((x) => {
          const token = tokenOf(x.id);
          const body = (
            <>
              <span className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-mango-deep">{x.about}</span>
                {x.tone && <ToneChip tone={x.tone} />}
              </span>
              <span className="mt-1 block text-[16px] font-bold leading-snug tracking-[-0.02em] text-ink">{x.title}</span>
              <span className="mt-1 block text-[14px] leading-relaxed text-sub">{x.text}</span>
            </>
          );
          return (
            <li key={x.title}>
              {token ? (
                <Link href={`/article/${token}`} onClick={onClose} className="block py-3.5 no-underline">
                  {body}
                </Link>
              ) : (
                <div className="py-3.5">{body}</div>
              )}
            </li>
          );
        })}
        {care.checks.map((c) => {
          const token = tokenOf(c.id);
          const cls = "flex items-start gap-2.5 py-3.5 text-[14px] font-medium leading-relaxed text-ink no-underline";
          const body = (
            <>
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-mango" aria-hidden="true" />
              <span>{c.text}</span>
            </>
          );
          return (
            <li key={c.text}>
              {token ? (
                <Link href={`/article/${token}`} onClick={onClose} className={cls}>
                  {body}
                </Link>
              ) : (
                <p className={cls}>{body}</p>
              )}
            </li>
          );
        })}
      </ul>
      {care.hint && (
        <div className="mt-1 rounded-2xl bg-snow px-4 py-3.5">
          {care.hint.title && <p className="text-[15px] font-bold leading-snug tracking-[-0.02em] text-ink">{care.hint.title}</p>}
          <p className={`text-[14px] leading-relaxed text-sub ${care.hint.title ? "mt-1" : ""}`}>{care.hint.text}</p>
          <Link href="/settings#personal" onClick={onClose} className="mt-2 inline-block text-[13px] font-semibold text-mango-deep underline underline-offset-4">
            맞춤 정보 고르기
          </Link>
        </div>
      )}
    </Part>
  );
}


/** 맹고가 무엇을 하고 있는지(시작 초·끝 초, 마지막은 끝없이). 서버가 진행을 알려 주지 않아서 기다린 시간으로 바꾼다 */
function makingLines(name: string | null, count: number): { text: string; from: number; to?: number }[] {
  const who = name ? `${name}님` : "회원님";
  return [
    { text: `${who} 관심사를 맹고가 열심히 분석하고 있어요`, from: 0, to: 3 },
    { text: `오늘 소식 ${count}개를 하나로 엮고 있어요`, from: 3, to: 5 },
    { text: `${who}에게 어떤 영향이 있는지 짚고 있어요`, from: 5, to: 8 },
    { text: "거의 다 됐어요", from: 8, to: 20 },
    { text: "조금만 더 기다려 주세요", from: 20 },
  ];
}

/**
 * 흐름을 만드는 동안(처음 열 때 보통 5~10초, 미리 만들어 둔 사람은 바로 나온다) '오늘의 흐름' 자리의 진행 카드.
 * 2026-11-13 사용자: 회색 뼈대 대신 'OO님 관심사를 맹고가 열심히 분석하고 있어요 → 거의 다 됐어요'처럼 무엇을 하는지 보여 주고, 진행률도.
 * 머리는 InsightHead(제목만), 카드 자리는 흐름 카드와 같은 크기의 남색 카드: 앱 아이콘·바뀌는 말·진행 막대·%.
 * 말 바뀜·진행률은 CSS 애니메이션만으로 한다(globals.css making-*): 서버가 먼저 그린 이 대체 화면은 React가 브라우저에서 살리지 않아(기다리는 경계의
 * 대체 화면은 하이드레이션하지 않는다) JS 타이머가 돌지 않았다. 끝을 모르므로 100%는 채우지 않는다. 다 되면 이 화면이 통째로 바뀐다
 */
export function InsightFallback() {
  const { data } = useToday();
  const name = useCallName();
  const count = Math.min(data.items.length, data.dailyLimit || data.items.length);
  const lines = makingLines(name, count);
  return (
    <section aria-labelledby="flows-title" className="mt-4">
      <div className="flex min-h-11 items-center px-1.5">
        <h2 id="flows-title" className="text-[20px] font-extrabold tracking-[-0.04em]">
          오늘의 흐름
        </h2>
      </div>
      {/* 흐름 카드와 같은 틀(위 남색 칸 = 사진 자리, 아래 회색 줄 = 영향·핵심 요약 자리)이라 다 되면 같은 자리에 카드가 들어온다 */}
      <div className="mx-1.5 mt-1 overflow-hidden rounded-[22px] border border-line">
      <div className="flex h-[228px] flex-col justify-center bg-[#1F2340] px-5">
        <p role="status" className="sr-only">
          맞춤 인사이트를 만들고 있어요. 보통 5~10초 걸려요
        </p>
        <div className="flex items-center gap-3" aria-hidden="true">
          {/* 서류를 뒤지던 맹고 캐릭터가 있던 자리에 새 앱 아이콘 (2026-11-26 사용자: 캐릭터 자리에 새 앱 아이콘). 스크립트 없이 CSS 움직임(bob)만 */}
          <MangoIcon className="bob size-14 shrink-0" />
          {/* 다섯 문장을 한 자리에 겹쳐 두고 시간대마다 하나만 보인다 */}
          <div className="grid min-w-0 flex-1">
            {lines.map((l) => (
              <p
                key={l.from}
                className={`${l.to ? "making-line" : "making-line making-line-last"} self-center text-[17px] font-bold leading-snug tracking-[-0.03em] text-white text-balance [grid-area:1/1]`}
                style={{ "--making-at": `${l.from}s`, "--making-for": `${(l.to ?? l.from + 1) - l.from}s` } as CSSProperties}
              >
                {l.text}
              </p>
            ))}
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3" aria-hidden="true">
          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="making-fill stripes h-full rounded-full bg-mango" />
          </div>
          <span className="making-pct w-11 shrink-0 text-right font-round text-[15px] font-extrabold tabular-nums text-mango" />
        </div>
      </div>
      <div aria-hidden="true" className="flex h-[170px] flex-col px-4 pt-4">
        <div className="sk h-[18px] w-11/12 rounded-md" />
        <div className="sk mt-2 h-[18px] w-3/5 rounded-md" />
        <div className="sk mt-4 h-3.5 w-4/5 rounded-md" />
        <div className="sk mt-2.5 h-3.5 w-2/3 rounded-md" />
      </div>
      </div>
    </section>
  );
}
