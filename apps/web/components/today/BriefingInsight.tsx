"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { answerContextAction } from "@/app/(app)/context-actions";
import { IconCheck, IconPlay } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { CountUp } from "@/components/ui/CountUp";
import { Sheet } from "@/components/ui/Sheet";
import { SECTION_LABEL, isSection } from "@maengo/core/sections";
import { SLOT_LABEL } from "@maengo/core/sections";
import type { FeedItem } from "@/lib/types";
import type { BriefingInsight } from "@/lib/server/briefing-insight";
import type { PickedQuestion } from "@/lib/server/user-context";
import { SKIP } from "@/lib/context";
import { Spinner } from "@/components/ui/Spinner";

/**
 * 오늘 화면 머리(2026-11-11 사용자: '약 15분 · 소식 10개'는 안 중요하다 → 오늘의 흐름 한 줄이 큰 제목, 'OO님에게 맞춤 인사이트'라고 부른다).
 * 흐름이 있으면: 'OO님에게 맞춤 인사이트' → 큰 제목(흐름 한 줄) → '날짜 출근길 · 언론 N곳, 기사 N건에서 골랐어요' → 흐름 카드 → 확인할 것.
 * 못 만들었으면 예전처럼 날짜 줄 → '출근길 브리핑' → 언론·기사 수.
 * 흐름은 서버가 만들어 끼운다(today/page.tsx, lib/server/briefing-insight.ts). 만드는 동안은 같은 모양의 회색 줄(InsightFallback)
 */
export function BriefingHero({
  insight,
  question = null,
  briefing = "",
}: {
  insight: BriefingInsight | null;
  /** 오늘 소식과 관계있는 내 맞춤 정보 질문(없으면 null, lib/server/user-context.ts pickQuestion) */
  question?: PickedQuestion | null;
  /** '날짜:am|pm'(새 질문은 브리핑마다 하나) */
  briefing?: string;
}) {
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
      <Basis insight={insight} pm={pm} />
      <Collected pm={pm} withDate />
      <Flows insight={insight} pm={pm} />
      <MatchCheck insight={insight} question={question} briefing={briefing} />
    </>
  );
}

/** 'OO님에게 맞춤 인사이트'(이름이 없으면 회원님) */
function ForYou({ pm }: { pm: boolean }) {
  const { displayName } = useProfile();
  const name = displayName?.trim() || "회원";
  return <p className={`text-[13px] font-bold ${pm ? "text-mango" : "text-mango-deep"}`}>{name}님에게 맞춤 인사이트</p>;
}

/**
 * 무엇을 바탕으로 엮었는지(2026-11-11 사용자: 나한테 맞춤인지 확인이 안 된다). 서버가 DB에서 센 값(자주 보는 분야, 최근 7일 읽거나 들은 소식 수)
 * 예: 'OO님이 자주 보는 경제·IT/과학 분야와 이번 주 본 소식 12개를 바탕으로 엮었어요.'
 */
function Basis({ insight, pm }: { insight: BriefingInsight; pm: boolean }) {
  const { displayName } = useProfile();
  const b = insight.basis;
  if (!b || (!b.sections.length && !b.recent)) return null;
  const name = displayName?.trim() || "회원";
  const parts = [b.sections.length ? `자주 보는 ${b.sections.join("·")} 분야` : "", b.recent ? `이번 주 본 소식 ${b.recent}개` : ""].filter(Boolean);
  return (
    <p className={`mt-2 text-[14px] font-medium leading-snug ${pm ? "text-white/85" : "text-ink/80"}`}>
      {name}님이 {parts.join("와 ")}를 바탕으로 엮었어요.
    </p>
  );
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
 * OO님 맞춤 체크(2026-11-11 사용자: 체크가 눈에 안 띈다. 사용자 맞춤 체크 항목이어야 한다).
 * 망고색 블록: 내 맞춤 정보로 짚은 소식(예: 국내 주식 → 금리 인상의 영향) → 생활 속 확인할 것 → 오늘 소식과 관계있는 질문 하나(딸깍).
 * 셋 다 없으면 그리지 않는다
 */
function MatchCheck({ insight, question, briefing }: { insight: BriefingInsight; question: PickedQuestion | null; briefing: string }) {
  const { data } = useToday();
  const { displayName } = useProfile();
  const name = displayName?.trim() || "회원";
  const personal = insight.personal ?? [];
  const checks = insight.checks.slice(0, 1);
  if (!personal.length && !checks.length && !question) return null;
  const tokenOf = (id: number) => data.items.find((i) => i.clusterId === id)?.token;
  return (
    <section aria-labelledby="match-title" className="-mx-1.5 mt-4 rounded-[24px] bg-mango px-3 pb-3 pt-4 text-[#1F2340]">
      <h2 id="match-title" className="px-1.5 text-[15px] font-bold tracking-[-0.02em]">
        {name}님 맞춤 체크
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {personal.map((x) => {
          const token = tokenOf(x.id);
          const body = (
            <>
              <span className="inline-flex rounded-full bg-[#1F2340] px-2.5 py-1 text-[12px] font-bold text-mango">{x.about}</span>
              <span className="mt-2 block text-[17px] font-bold leading-snug tracking-[-0.025em]">{x.title}</span>
              <span className="mt-1 block text-[14px] leading-relaxed text-[#1F2340]/80">{x.text}</span>
            </>
          );
          return token ? (
            <Link key={x.title} href={`/article/${token}`} className="block rounded-[18px] bg-white px-4 py-3.5 no-underline">
              {body}
            </Link>
          ) : (
            <div key={x.title} className="rounded-[18px] bg-white px-4 py-3.5">
              {body}
            </div>
          );
        })}
        {checks.map((c) => {
          const token = tokenOf(c.id);
          const cls = "flex items-start gap-2.5 rounded-[18px] bg-white/60 px-4 py-3 text-[14px] font-medium leading-relaxed no-underline";
          const body = (
            <>
              <IconCheck className="mt-[3px] size-4 shrink-0 text-[#1F2340] [stroke-width:3]" />
              <span>{c.text}</span>
            </>
          );
          return token ? (
            <Link key={c.text} href={`/article/${token}`} className={cls}>
              {body}
            </Link>
          ) : (
            <p key={c.text} className={cls}>
              {body}
            </p>
          );
        })}
        {question && <AskCard key={question.key} q={question} briefing={briefing} />}
      </div>
    </section>
  );
}

/** 내 맞춤 정보 질문(딸깍). 답하면 다시 그려 맞춤 체크가 그 답으로 바뀌고, 이어 묻는 질문이 있으면 바로 나온다 */
function AskCard({ q, briefing }: { q: PickedQuestion; briefing: string }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const answer = (value: string) =>
    start(async () => {
      setPicked(value);
      const res = await answerContextAction(q.key, value, briefing);
      if (res.ok) router.refresh();
      else setPicked(null);
    });
  return (
    <div className="rounded-[18px] bg-[#1F2340] px-4 pb-3 pt-3.5 text-white">
      <p className="text-[12px] font-semibold text-mango">{q.about}이 있어서 여쭤봐요</p>
      <p className="mt-1 text-[18px] font-bold tracking-[-0.025em]">{q.ask}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={q.ask}>
        {q.options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={busy}
            aria-pressed={picked === o.value}
            onClick={() => answer(o.value)}
            className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-bold active:scale-95 motion-reduce:active:scale-100 ${picked === o.value ? "bg-mango text-[#1F2340]" : "bg-white/12 text-white"}`}
          >
            {busy && picked === o.value && <Spinner />}
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-end">
        <button type="button" disabled={busy} onClick={() => answer(SKIP)} className="min-h-10 px-1 text-[13px] font-semibold text-white/60">
          나중에
        </button>
      </div>
    </div>
  );
}

/**
 * 흐름 상세(시트, 2026-11-11 사용자: 누르면 상세를 볼 수 있어야 한다).
 * 왜 OO님에게(회원 기록 근거) → 흐름 설명 → 지켜볼 것 → 묶인 소식(누르면 소식 상세) → 이 흐름부터 듣기
 */
function FlowDetail({ flow, onClose }: { flow: BriefingInsight["flows"][number]; onClose: () => void }) {
  const { data, listenAccess } = useToday();
  const { displayName } = useProfile();
  const p = usePlayer();
  const name = displayName?.trim() || "회원";
  const related = flow.ids.map((id) => data.items.find((i) => i.clusterId === id)).filter((i): i is FeedItem => !!i);
  const canListen = p.enabled && related.some((i) => listenAccess(i.clusterId) !== null);
  return (
    <div className="pb-2">
      {flow.why && (
        <div className="rounded-2xl bg-mango-tint px-4 py-3">
          <p className="text-[12px] font-bold text-mango-deep">왜 {name}님에게</p>
          <p className="mt-1 text-[15px] font-medium leading-relaxed text-ink">{flow.why}</p>
        </div>
      )}
      <p className="mt-4 text-[16px] leading-[1.7] text-ink">{flow.text}</p>
      {!!flow.watch?.length && (
        <div className="mt-5">
          <p className="text-[13px] font-bold text-sub">지켜볼 것</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {flow.watch.map((w) => (
              <li key={w} className="flex gap-2 text-[15px] leading-relaxed text-ink">
                <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-mango" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-6 text-[13px] font-bold text-sub">묶인 소식 {related.length}개</p>
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
                  // eslint-disable-next-line @next/next/no-img-element -- 원문 사진 주소(언론사마다 달라 next/image 허용 목록에 넣을 수 없다)
                  <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[3/2] w-[84px] shrink-0 rounded-xl object-cover" />
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
