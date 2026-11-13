"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import { IconCheck, IconPlay } from "@/components/icons";
import { BusyMango } from "@/components/BusyMango";
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

/**
 * 오늘 화면 머리(2026-11-11 사용자: '약 15분 · 소식 10개'는 안 중요하다 → 오늘의 흐름 한 줄이 큰 제목, 'OO님에게 맞춤 인사이트'라고 부른다).
 * 흐름이 있으면: 'OO님에게 맞춤 인사이트' → 큰 제목(흐름 한 줄) → '날짜 출근길' → 흐름 카드 → 확인할 것.
 * 못 만들었으면 예전처럼 날짜 줄 → '출근길 브리핑'.
 * 언론 N곳·기사 N건은 보여 주지 않는다(2026-11-12 사용자: 날짜만)
 * 흐름은 서버가 만들어 끼운다(today/page.tsx, lib/server/briefing-insight.ts). 만드는 동안은 같은 모양의 회색 줄(InsightFallback)
 */
export function BriefingHero({
  insight: made,
  label,
  failed = false,
  personalOff = false,
}: {
  insight: BriefingInsight | null;
  label?: string;
  /** 소식은 있는데 만들지 못했다(모델 오류·키 없음). 다시 열면 다시 만든다 */
  failed?: boolean;
  /** 설정에서 맞춤 인사이트를 껐다(맞춤 체크가 비는 게 정상이라 읽을수록 좋아진다는 안내를 하지 않는다) */
  personalOff?: boolean;
}) {
  const { data } = useToday();
  const name = useCallName();
  const insight = made && withName(made, name);
  const pm = data.slot === "pm";
  const slotLabel = SLOT_LABEL[data.slot ?? "am"];
  if (!insight) {
    return (
      <>
        <DateLine pm={pm} />
        <h1 id="briefing-title" className="mt-1 text-[26px] font-bold tracking-[-0.035em]">
          {slotLabel} 브리핑
        </h1>
        {failed && (
          <p role="status" className={`mt-1.5 text-[14px] font-medium leading-snug ${pm ? "text-white/70" : "text-sub"}`}>
            오늘의 인사이트를 만들지 못했어요. 잠시 뒤 다시 열어 주세요.
          </p>
        )}
      </>
    );
  }
  return (
    <>
      <ForYou pm={pm} label={label} />
      <h1 id="briefing-title" className="mt-1.5 text-[25px] font-bold leading-[1.3] tracking-[-0.035em] text-balance">
        {insight.headline}
      </h1>
      <Basis insight={insight} pm={pm} />
      <DateBelow pm={pm} />
      <Flows insight={insight} pm={pm} />
      <MatchCheck insight={insight} personalOff={personalOff} />
    </>
  );
}

/**
 * AI가 쓴 글에 남은 'OO님'·'회원님'을 프로필 이름으로(형식 4부터는 AI가 부르지 않는다. 그 전에 만든 글이 다시 만들지 못해 남았을 때만).
 * 이름은 Gemini에 보내지 않는다(개인정보 처리방침 5조)
 */
function withName(insight: BriefingInsight, name: string | null): BriefingInsight {
  // 이름 없는 계정(운영엔 없다)만 '회원님'
  const call = name ? `${name}님` : "회원님";
  const n = (s: string) => s.replace(/(?:OO|○○|회원)님/g, call);
  return {
    ...insight,
    headline: n(insight.headline),
    // 꼬리표에 호칭이 들어가면('주식하는 당신') 꼬리표를 숨긴다(AI가 부르지 말라는 말을 어길 때)
    flows: insight.flows.map((f) => ({ ...f, title: n(f.title), text: n(f.text), tag: f.tag && !/당신|님/.test(f.tag) ? f.tag : "", why: f.why && n(f.why), watch: f.watch?.map(n) })),
    checks: insight.checks.map((c) => ({ ...c, text: n(c.text) })),
    personal: insight.personal?.map((x) => ({ ...x, title: n(x.title), text: n(x.text) })),
  };
}

/** 'OO님에게 맞춤 인사이트'(OO은 프로필 이름. 없으면 '나에게'). label을 주면 그 말(토스 미니앱 공통판: 회원 맞춤이 아니라서) */
function ForYou({ pm, label }: { pm: boolean; label?: string }) {
  const name = useCallName();
  return <p className={`text-[13px] font-bold ${pm ? "text-mango" : "text-mango-deep"}`}>{label ?? `${name ? `${name}님에게` : "나에게"} 맞춤 인사이트`}</p>;
}

/**
 * 무엇을 바탕으로 엮었는지(2026-11-11 사용자: 나한테 맞춤인지 확인이 안 된다). 서버가 DB에서 센 값(자주 보는 분야, 최근 7일 읽거나 들은 소식 수)
 * 예: 'OO님이 자주 보는 경제·IT/과학 분야와 이번 주 본 소식 12개를 바탕으로 엮었어요.'
 */
function Basis({ insight, pm }: { insight: BriefingInsight; pm: boolean }) {
  const name = useCallName();
  const b = insight.basis;
  if (!b || (!b.sections.length && !b.recent)) return null;
  // 최근 본 소식이 적으면 '자주 보는'이 아니라 '고른' 분야(2026-11-13: 읽은 게 0개인데 '자주 보는 정치'라고 했다). 예전 형식은 seen이 없어 본 수로 가른다
  const seen = b.seen ?? b.recent >= 3;
  const parts = [b.sections.length ? `${seen ? "자주 보는" : "고른"} ${b.sections.join("·")} 분야` : "", b.recent ? `이번 주 본 소식 ${b.recent}개` : ""].filter(Boolean);
  return (
    <p className={`mt-2 text-[14px] font-medium leading-snug ${pm ? "text-white/85" : "text-ink/80"}`}>
      {name ? `${name}님이 ` : ""}{parts.join("와 ")}를 바탕으로 엮었어요.
    </p>
  );
}

/** '11월 11일 수요일'(때를 가리키는 끝말은 뗀다. 2026-11-12 사용자: 출근길·퇴근길은 빼고 날짜·요일만) */
function useDateLabel(): string {
  const { data } = useToday();
  return data.greetingDate.replace(/\s*(오전|오후|새벽|아침|점심|낮|저녁|밤)$/, "");
}

function DateLine({ pm }: { pm: boolean }) {
  return <p className={`text-[13px] font-medium ${pm ? "text-white/65" : "text-sub"}`}>{useDateLabel()}</p>;
}

/** 큰 제목 아래 날짜·출근길(2026-11-12 사용자: 언론 N곳·기사 N건은 빼고 날짜만) */
function DateBelow({ pm }: { pm: boolean }) {
  return <p className={`mt-1.5 text-[13px] ${pm ? "text-white/65" : "text-sub"}`}>{useDateLabel()}</p>;
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
    { card: "bg-[#1F2340] text-white", sub: "text-white/75", count: "text-mango", ring: "ring-[#1F2340]", tag: "bg-white/12 text-mango" },
    { card: "bg-mango text-[#1F2340]", sub: "text-[#1F2340]/75", count: "text-[#1F2340]", ring: "ring-mango", tag: "bg-[#1F2340]/10 text-[#1F2340]" },
    { card: "bg-paper text-ink shadow-[0_0_0_1px_var(--color-line)]", sub: "text-sub", count: "text-mango-deep", ring: "ring-paper", tag: "bg-mango-tint text-mango-deep" },
  ],
  pm: [
    { card: "bg-mango text-[#1F2340]", sub: "text-[#1F2340]/75", count: "text-[#1F2340]", ring: "ring-mango", tag: "bg-[#1F2340]/10 text-[#1F2340]" },
    { card: "bg-white/10 text-white", sub: "text-white/70", count: "text-mango", ring: "ring-[#2B2F4E]", tag: "bg-white/12 text-mango" },
    { card: "bg-white text-[#1F2340]", sub: "text-[#1F2340]/70", count: "text-mango-deep", ring: "ring-white", tag: "bg-mango-tint text-mango-deep" },
  ],
} as const;

/**
 * 흐름 카드(2026-11-11 사용자: 회색 상자·노란 막대 목록은 너무 구리다 → 옆으로 넘기는 카드).
 * 사진이 있는 소식이 일부뿐이라 사진에 기대지 않는다: 남색·망고·흰색 바탕에 흐름 이름을 크게, 설명 세 줄, 아래 묶인 소식 사진(있으면 작은 동그라미)과 소식 수. 누르면 그 소식 카드로.
 * 확인할 것은 카드 아래 연한 망고색 줄로 따로
 */
function Flows({ insight, pm }: { insight: BriefingInsight; pm: boolean }) {
  const { data } = useToday();
  /** 열어 본 흐름(상세 시트) */
  const [open, setOpen] = useState<number | null>(null);
  const opened = open === null ? null : insight.flows[open];
  return (
    <>
      <ul aria-label="오늘의 흐름" className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {insight.flows.map((f, k) => {
          const tone = TONES[pm ? "pm" : "am"][k % 3]!;
          const photos = photosOf(f.ids, data.items);
          return (
            <li key={f.title} className="w-[80%] max-w-[300px] shrink-0 snap-start">
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setOpen(k)}
                className={`flex h-full w-full flex-col rounded-[22px] px-5 pb-4 pt-4 text-left active:scale-[0.98] motion-reduce:active:scale-100 ${tone.card}`}
              >
                {/* 이 사람과의 연결(회원 기록에서, 없으면 안 그린다) */}
                {f.tag && <span className={`mb-2.5 inline-flex self-start rounded-full px-2.5 py-1 text-[12px] font-semibold ${tone.tag}`}>{f.tag}</span>}
                <span className={`text-[19px] font-bold leading-[1.3] tracking-[-0.035em] text-balance ${f.tag ? "" : "mt-1"}`}>{f.title}</span>
                {/* 나에게 미칠 영향이 있으면 그것을 먼저(2026-11-13 사용자: 나한테 유용한지 부각되지 않는다), 없으면 흐름 설명 */}
                {f.effect ? (
                  <span className="mt-2 flex flex-col gap-1">
                    <span className={`flex items-center gap-1 text-[12px] font-bold ${tone.count}`}>
                      <ToneIcon tone={f.tone ?? "watch"} className="size-3.5" />
                      나에게
                    </span>
                    <span className="line-clamp-3 text-[15px] font-semibold leading-[1.5]">{f.effect}</span>
                  </span>
                ) : (
                  <span className={`mt-2 line-clamp-3 text-[14px] leading-[1.55] ${tone.sub}`}>{f.text}</span>
                )}
                <span className="mt-auto flex items-center gap-2 pt-4">
                  {photos.length > 0 && (
                    <span className="flex -space-x-2">
                      {photos.map((src) => (
                        <PhotoImg key={src} src={src} className={`size-7 rounded-full ring-2 ${tone.ring}`} />
                      ))}
                    </span>
                  )}
                  <span className={`text-[13px] font-semibold ${tone.count}`}>소식 {f.ids.length}개 · 자세히</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Sheet title={opened?.title ?? ""} open={!!opened} onClose={() => setOpen(null)}>
        {opened && <FlowDetail flow={opened} onClose={() => setOpen(null)} />}
      </Sheet>
    </>
  );
}

/**
 * 맞춤 체크(2026-11-11 사용자: 체크가 눈에 안 띈다. 사용자 맞춤 체크 항목이어야 한다. 이름은 넣지 않는다 — 이름이 너무 많다).
 * 조용한 정보 칸: 내 맞춤 정보·읽던 소식으로 짚은 영향(예: 국내 주식 → 금리 인상의 영향) → 생활 속 확인할 것. 둘 다 없으면 그리지 않는다.
 * 내 맞춤 정보 질문은 여기서 묻지 않는다(대놓고 묻지 말라는 사용자 결정, components/context/ContextAsk.tsx)
 */
function MatchCheck({ insight, personalOff }: { insight: BriefingInsight; personalOff: boolean }) {
  const { data } = useToday();
  const name = useCallName();
  const personal = insight.personal ?? [];
  const checks = insight.checks.slice(0, 1);
  // 맞춤 체크가 비었거나 읽은 소식이 적으면 왜인지와 어떻게 하면 좋아지는지 알린다(2026-11-13 사용자: '이전에 읽던 소식이 아직 없다', '많이 읽을수록 분석을 잘해 준다')
  const recent = insight.basis?.recent ?? 0;
  const few = recent < SEEN_MIN;
  const hint = !personalOff && (!personal.length || few);
  if (!personal.length && !checks.length && !hint) return null;
  const tokenOf = (id: number) => data.items.find((i) => i.clusterId === id)?.token;
  // 퇴근길(남색 바탕)에서는 글자를 밝게(2026-11-13: 제목이 남색 글자라 안 보였다)
  const pm = data.slot === "pm";
  // 조용한 정보 칸(2026-11-11 사용자: 망고색 블록은 너무 튀고 메인 소식처럼 보인다 → 테두리도 없이). 망고색은 체크 표시와 근거 글자에만
  return (
    <section aria-labelledby="match-title" className="mt-7">
      <h2 id="match-title" className="flex items-center gap-1.5 text-[15px] font-bold tracking-[-0.02em]">
        <IconCheck className="size-4 text-mango-deep [stroke-width:3]" />
        맞춤 체크
      </h2>
      <ul className={`mt-1 divide-y ${pm ? "divide-white/10" : "divide-line"}`}>
        {personal.map((x) => {
          const token = tokenOf(x.id);
          const body = (
            <>
              <span className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-mango-deep">{x.about}</span>
                {x.tone && <ToneChip tone={x.tone} onDark={pm} />}
              </span>
              <span className={`mt-1 block text-[16px] font-bold leading-snug tracking-[-0.02em] ${pm ? "text-white" : "text-ink"}`}>{x.title}</span>
              <span className={`mt-1 block text-[14px] leading-relaxed ${pm ? "text-white/65" : "text-sub"}`}>{x.text}</span>
            </>
          );
          return (
            <li key={x.title}>
              {token ? (
                <Link href={`/article/${token}`} className="block py-3.5 no-underline">
                  {body}
                </Link>
              ) : (
                <div className="py-3.5">{body}</div>
              )}
            </li>
          );
        })}
        {checks.map((c) => {
          const token = tokenOf(c.id);
          const cls = `flex items-start gap-2.5 py-3.5 text-[14px] font-medium leading-relaxed no-underline ${pm ? "text-white/85" : "text-ink"}`;
          const body = (
            <>
              <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-mango" aria-hidden="true" />
              <span>{c.text}</span>
            </>
          );
          return (
            <li key={c.text}>
              {token ? (
                <Link href={`/article/${token}`} className={cls}>
                  {body}
                </Link>
              ) : (
                <p className={cls}>{body}</p>
              )}
            </li>
          );
        })}
      </ul>
      {hint && (
        <div className={`mt-1 rounded-2xl px-4 py-3.5 ${pm ? "bg-white/8" : "bg-snow"}`}>
          {!personal.length && (
            <p className={`text-[15px] font-bold leading-snug tracking-[-0.02em] ${pm ? "text-white" : "text-ink"}`}>
              {recent === 0 ? "아직 읽은 소식이 없어서 맞춤 체크를 만들지 못했어요" : "오늘은 맞춤 체크로 짚을 소식이 없어요"}
            </p>
          )}
          <p className={`text-[14px] leading-relaxed ${personal.length ? "" : "mt-1"} ${pm ? "text-white/70" : "text-sub"}`}>
            {personal.length
              ? "소식을 많이 읽을수록 맞춤 체크가 더 정확해져요."
              : `소식을 많이 읽고 들을수록 ${name ? `${name}님에게` : "나에게"} 맞는 인사이트를 더 정확하게 분석해 드려요.`}
          </p>
          <Link href="/settings#personal" className={`mt-2 inline-block text-[13px] font-semibold underline underline-offset-4 ${pm ? "text-mango" : "text-mango-deep"}`}>
            맞춤 정보 고르기
          </Link>
        </div>
      )}
    </section>
  );
}

/** 영향의 성격 표시(2026-11-13 사용자: 신뢰도 있는 말투 → 차분한 분석 용어) */
const TONE_LABEL: Record<InsightTone, string> = { plus: "긍정 요인", minus: "부담 요인", watch: "지켜볼 변수" };

/**
 * 성격 표시: 긍정 요인 체크, 부담 요인 경고 삼각형, 지켜볼 변수 눈.
 * 화살표(↗·↘)는 쓰지 않는다(2026-11-13 사용자: 국내 증시가 급락했는데 '↘ 부담 요인'이 부담이 내려간 것처럼 보인다). 방향이 아니라 성격을 나타낸다
 */
function ToneIcon({ tone, className = "size-3.5" }: { tone: InsightTone; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {tone === "plus" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.4l2.8 2.8L16.2 9.8" />
        </>
      ) : tone === "minus" ? (
        <>
          <path d="M10.3 4.2L2.6 18a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z" />
          <path d="M12 9.5v4.5" />
          <path d="M12 17.4v.1" />
        </>
      ) : (
        <>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
    </svg>
  );
}

/** 성격 배지(긍정 요인 파랑, 부담 요인 주황, 지켜볼 변수 빨강). onDark: 남색 바탕 위 */
function ToneChip({ tone, onDark = false }: { tone: InsightTone; onDark?: boolean }) {
  const cls =
    tone === "plus"
      ? onDark
        ? "bg-[#8DB4FF]/20 text-[#B9D0FF]"
        : "bg-plus-tint text-plus"
      : tone === "minus"
        ? onDark
          ? "bg-[#FFA35C]/20 text-[#FFC79A]"
          : "bg-minus-tint text-minus"
        : onDark
          ? "bg-[#FF8A8F]/20 text-[#FFB6B9]"
          : "bg-watch-tint text-watch";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${cls}`}>
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
 * 번호(①②③)는 순서가 아니라서 뺐다. 판단이 없는 예전 형식은 '왜'를 영향 자리에
 */
function FlowDetail({ flow, onClose }: { flow: BriefingInsight["flows"][number]; onClose: () => void }) {
  const { data, listenAccess } = useToday();
  const p = usePlayer();
  const related = flow.ids.map((id) => data.items.find((i) => i.clusterId === id)).filter((i): i is FeedItem => !!i);
  const canListen = p.enabled && related.some((i) => listenAccess(i.clusterId) !== null);
  const sources = sourceLine(related);
  const links = flow.links?.length ? flow.links : flow.tag ? [flow.tag] : [];
  const relation = flow.relation ?? "";
  const effect = flow.effect || flow.why;
  const tone: InsightTone = flow.effect && flow.tone ? flow.tone : "watch";
  const verdict = VERDICT[tone];
  return (
    <div className="pb-2">
      {/* 맹고 분석: 이 화면에서 눈에 띄는 단 하나 */}
      {effect && (
        <section aria-label="맹고 분석" className={`border-l-4 pl-4 ${verdict.rule}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <p className="text-[13px] font-semibold text-sub">맹고 분석</p>
            {links.map((l) => (
              <span key={l} className="rounded-full bg-mango-tint px-2 py-0.5 text-[12px] font-semibold text-mango-deep">
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
 * 흐름을 만드는 동안(처음 열 때 보통 5~10초, 미리 만들어 둔 사람은 바로 나온다).
 * 2026-11-13 사용자: 회색 뼈대 대신 'OO님 관심사를 맹고가 열심히 분석하고 있어요 → 거의 다 됐어요'처럼 무엇을 하는지 보여 주고, 진행률도.
 * 머리는 다 된 화면과 같은 'OO님에게 맞춤 인사이트'·날짜(덜 밀리게), 큰 제목 자리는 빛이 지나가는 줄, 흐름 카드 자리는 서류를 뒤지는 맹고·바뀌는 말·진행 막대·%.
 * 말 바뀜·진행률은 CSS 애니메이션만으로 한다(globals.css making-*): 서버가 먼저 그린 이 대체 화면은 React가 브라우저에서 살리지 않아(기다리는 경계의
 * 대체 화면은 하이드레이션하지 않는다) JS 타이머가 돌지 않았다. 끝을 모르므로 100%는 채우지 않는다. 다 되면 이 화면이 통째로 바뀐다
 */
export function InsightFallback() {
  const { data } = useToday();
  const pm = data.slot === "pm";
  const name = useCallName();
  const count = Math.min(data.items.length, data.dailyLimit || data.items.length);
  const lines = makingLines(name, count);
  return (
    <>
      <ForYou pm={pm} />
      <h1 id="briefing-title" className="sr-only">
        {SLOT_LABEL[data.slot ?? "am"]} 브리핑
      </h1>
      <div aria-hidden="true" className="mt-2.5">
        <div className={`h-6 w-[88%] rounded-lg ${pm ? "sk-night" : "sk"}`} />
        <div className={`mt-2 h-6 w-[58%] rounded-lg ${pm ? "sk-night" : "sk"}`} />
      </div>
      <DateBelow pm={pm} />
      <div className={`mt-4 rounded-[22px] px-5 pb-5 pt-4 ${pm ? "bg-white/10" : "bg-[#1F2340]"}`}>
        <p role="status" className="sr-only">
          맞춤 인사이트를 만들고 있어요. 보통 5~10초 걸려요
        </p>
        <div className="flex items-center gap-3" aria-hidden="true">
          {/* 서류 더미를 바쁘게 뒤지는 맹고(2026-11-13 사용자: 맹고가 너무 가만히 있다). 뒤에서 종이가 휙휙 날아가고 맹고는 갸웃거린다. globals.css busy-* */}
          <BusyMango />
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
        <div className="mt-4 flex items-center gap-3" aria-hidden="true">
          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="making-fill stripes h-full rounded-full bg-mango" />
          </div>
          <span className="making-pct w-11 shrink-0 text-right font-round text-[15px] font-extrabold tabular-nums text-mango" />
        </div>
      </div>
    </>
  );
}
