"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { IconCheck, IconClose, IconDoc, IconPause, IconPlay, IconSpeaker } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { Spinner } from "@/components/ui/Spinner";
import { useItemAudio } from "@/components/article/useItemAudio";
import { singleStarted, viaTodayPlayer } from "@/lib/player/route";
import { useArrivalHighlight, useMoreArrival, type Arrival } from "./arrival";
import { MakeToday } from "./MakeToday";
import { FillToday } from "./FillToday";
import { MoreToday } from "./MoreToday";
import { SignupGift } from "./SignupGift";
import type { FeedItem } from "@/lib/types";

/** 오늘 목록: 제목·요약·출처·작성자·작성일. 누르면 전체 글로. notice는 맨 위 결제 안내 띠(서버가 그린다, today/page.tsx) */
export function TodayList({ notice }: { notice?: React.ReactNode }) {
  const { data, game } = useToday();
  // '하나 더 받기'로 막 붙은 소식(스크롤하고 잠깐 짚는다)
  const { arrival, expect, settle } = useMoreArrival(data.items.map((i) => i.clusterId));
  // 플랜의 하루 소식 중 오늘 받은 수. 지갑으로 더 받은 건 세지 않는다(설정 > 플랜의 하루 소식과 같은 셈)
  const received = Math.min(data.items.length, data.dailyLimit);
  // 하루 소식에서 아직 못 받은 수. 있으면 '남은 소식 N개 받기'(맹고 없이), 다 받았으면 목록 아래 '하나 더 받기'(1맹고)
  const remaining = data.dailyLimit - received;
  return (
    <div className="mx-auto max-w-[640px] px-4 pt-5 lg:pt-8">
      <div className="min-w-0">
        {notice}
        {data.signupGift && <SignupGift gift={data.signupGift} />}
        <section aria-labelledby="today-title" className="keep-light rounded-2xl bg-mango px-5 pb-4 pt-4 shadow-[0_4px_0_var(--color-mango-dark)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-ink/70">{data.greetingDate}</p>
              <h1 id="today-title" className="mt-0.5 text-[24px] font-black tracking-[-0.03em]">
                {/* 비었을 때는 개수 없이 */}
                오늘의 소식{game.total > 0 && ` ${game.total}개`}
              </h1>
            </div>
            {game.total > 0 && <ListenAll />}
          </div>
          {game.total > 0 && (
            <p className="mt-1 text-[14px] font-semibold leading-snug text-ink/80">
              관심사 {data.topicNames.join(", ")}에서 골랐어요
            </p>
          )}
          {/* 오늘 받은 소식 / 플랜의 하루 소식(2026-10-20 사용자 결정, 읽음 기준에서 바꿈) */}
          {game.total > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <ProgressBar value={received / data.dailyLimit} tone="leaf" label="오늘 받은 소식" className="h-4 flex-1" track="bg-white/60" />
              <span className="font-round text-[17px] font-black tabular-nums">{`${received}/${data.dailyLimit}`}</span>
            </div>
          )}
          {game.total > 0 && remaining > 0 && <FillToday remaining={remaining} onExpect={expect} onSettle={settle} />}
        </section>

        {game.total > 0 ? (
          <ol className="mt-6 flex flex-col gap-4" aria-label="오늘의 소식">
            {data.items.map((item) => (
              <ArticleCard key={item.clusterId} item={item} arrival={arrival?.id === item.clusterId ? arrival : null} />
            ))}
          </ol>
        ) : (
          <MakeToday reason={data.emptyReason} notifyLabel={data.notifyLabel} />
        )}

        {game.allDone && <AllDone notifyLabel={data.notifyLabel} />}

        {game.total > 0 && remaining === 0 && <MoreToday cost={data.moreCost} kept={data.wallet} onExpect={expect} onSettle={settle} />}

        {/* 화면 읽기 도구에만: 터치로 '하나 더 받기'를 눌렀을 때(키보드면 새 소식 제목으로 초점이 간다) */}
        <p role="status" className="sr-only">
          {arrival && !arrival.focus ? `새 소식 ${arrival.count}개` : ""}
        </p>
      </div>
    </div>
  );
}

/** 오늘 소식을 다 읽거나 들었을 때 목록 끝('하나 더 받기' 위)에 붙는 작은 축하 카드 */
function AllDone({ notifyLabel }: { notifyLabel: string }) {
  return (
    <div className="tile mt-4 flex items-center gap-3 border-leaf-bright/40 bg-leaf-tint p-4">
      <Mascot mood="cheer" className="pop size-14 shrink-0" />
      <div className="min-w-0">
        <p className="text-[17px] font-black leading-snug tracking-[-0.02em] text-leaf-dark">오늘 소식 다 봤어요</p>
        <p className="mt-0.5 text-[14px] font-semibold text-ink/70">내일 {notifyLabel}에 새 소식이 와요</p>
      </div>
    </div>
  );
}

function ArticleCard({ item, arrival }: { item: FeedItem; arrival: Arrival | null }) {
  const { consumed } = useToday();
  const p = usePlayer();
  const profile = useProfile();
  const done = consumed(item.clusterId);
  // '하나 더 받기'로 막 붙은 소식이면 이 카드로 스크롤하고 잠깐 짚는다
  const cardRef = useRef<HTMLLIElement>(null);
  const titleRef = useRef<HTMLAnchorElement>(null);
  useArrivalHighlight(arrival, cardRef, titleRef);
  // 플레이어 목록에서의 자리. 번호가 아니라 소식으로 찾는다(듣는 동안 새로 받은 소식은 듣기가 끝날 때까지 플레이어 목록에 없다)
  const at = p.chapters.findIndex((c) => c.clusterId === item.clusterId);
  // 오늘 전체 음성이 이미 있거나 전체 듣기가 돌고 있으면 플레이어로, 아니면 이 소식 하나만 만들어 듣는다(플레이리스트를 듣는 중이면 하나만).
  // 에피소드 정보를 받기 전에 누른 글 하나 듣기는 정보가 와도 끊지 않는다(lib/player/route.ts)
  const single = useItemAudio(item.clusterId, p.enabled);
  const singleBusy = singleStarted(single.ctl);
  const viaPlayer = viaTodayPlayer({
    inPlayer: at >= 0,
    playlist: !!p.playlist,
    audioReady: p.audioReady,
    playerBusy: p.preparing || p.status !== "idle",
    singleBusy,
  });
  // 플레이어가 이어받으면(전체 듣기 등) 글 하나 듣기는 접는다
  const cancelSingle = single.ctl.cancel;
  useEffect(() => {
    if (viaPlayer && singleBusy) cancelSingle?.();
  }, [viaPlayer, singleBusy, cancelSingle]);
  const current = viaPlayer ? p.cur === at && p.status !== "done" : single.ctl.state === "playing" || single.ctl.state === "paused";
  const preparing = viaPlayer ? current && p.preparing : !!single.ctl.preparing;
  const playing = !preparing && (viaPlayer ? current && p.status === "playing" : single.ctl.state === "playing");
  const listen = () => {
    // 음성을 기다리는 중에 누르면 그만둔다(다 만들어져도 저절로 시작하지 않게)
    if (preparing) return viaPlayer ? p.cancel() : single.ctl.cancel?.();
    if (viaPlayer) return playing ? p.pause() : p.playOne(at);
    return playing ? single.ctl.pause() : single.ctl.play();
  };

  return (
    <li ref={cardRef} className={`tile relative p-4 transition-colors hover:bg-snow sm:p-5 ${current ? "border-sky" : ""}`}>
      <div className="flex items-center gap-2 text-[13px] font-extrabold">
        <CategoryChip category={item.category} />
        <SourceChip item={item} />
        {item.coverage && item.kind === "article" && <span className="hidden truncate font-bold text-sub sm:inline">{item.coverage}</span>}
        <span className="ml-auto shrink-0">
          {!viaPlayer && single.ctl.error ? (
            <span className="text-cherry">음성을 못 만들었어요</span>
          ) : preparing ? (
            <span className="text-sky">음성 만드는 중</span>
          ) : playing ? (
            <span className="text-sky">듣는 중</span>
          ) : done ? (
            <span className="inline-flex items-center gap-1 text-leaf">
              <IconCheck className="size-4 [stroke-width:3]" />
              읽음
            </span>
          ) : null}
        </span>
      </div>
      <h2 className="mt-2.5 text-[18px] font-black leading-snug tracking-[-0.02em]">
        {/* 카드 전체를 덮는 링크. 듣기 버튼만 그 위에 올라온다 */}
        <Link ref={titleRef} href={`/article/${item.clusterId}`} className={`no-underline after:absolute after:inset-0 after:rounded-2xl ${done ? "text-sub" : ""}`}>
          {item.title}
        </Link>
      </h2>
      <p className="mt-2 text-[15px] font-medium leading-relaxed text-sub">{item.short}</p>
      <div className="mt-3 flex items-center gap-3">
        <p className="min-w-0 truncate text-[13px]">
          <span className="font-extrabold">{item.author}</span>
          <span className="ml-2 font-semibold text-faint">{item.publishedLabel}</span>
        </p>
        {!profile.audio ? (
          // Free: 듣기 자리는 두고, 누르면 결제 페이지로(막힌 기능에서 안내하는 자리)
          <Link
            href="/premium"
            aria-label={`${item.title} 듣기, Premium에서 쓸 수 있어요`}
            className="relative z-10 ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border-2 border-line px-3 text-[14px] font-extrabold text-sub no-underline hover:bg-snow"
          >
            <IconSpeaker className="size-5" />
            듣기
            <PremiumBadge />
          </Link>
        ) : p.enabled && (
          <button
            type="button"
            onClick={listen}
            // 글 하나로 들을 때는 에피소드 정보와 관계없이 바로 누를 수 있다(정보를 받는 동안 깜빡이거나, 못 받았을 때 막히지 않게)
            disabled={viaPlayer && !p.ready}
            aria-label={preparing ? `${item.title} 음성 만들기 취소` : playing ? `${item.title} 그만 듣기` : `${item.title} 듣기`}
            className="btn btn-ghost relative z-10 ml-auto min-h-11 shrink-0 px-3 text-[14px]"
          >
            {preparing ? <IconClose className="size-4 text-sub" /> : playing ? <IconPause className="size-4 text-sky" /> : <IconSpeaker className="size-5 text-sky" />}
            {preparing ? "취소" : playing ? "멈춤" : "듣기"}
          </button>
        )}
      </div>
    </li>
  );
}

export function SourceChip({ item }: { item: FeedItem }) {
  const video = item.kind === "video";
  return (
    // 매체 이름이 길면 카드 머리줄을 넘지 않게 줄인다
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg px-2 py-0.5 text-[13px] font-extrabold ${video ? "bg-[#FFE9E6] text-[#B8321F] tone [--tone:#B8321F]" : "bg-sky-tint text-sky-dark"}`}>
      {video ? <IconPlay className="size-3.5 shrink-0" /> : <IconDoc className="size-3.5 shrink-0" />}
      <span className="truncate">{item.sourceLabel}</span>
    </span>
  );
}

/** 오늘 카드의 '전체 듣기': 오늘 소식 전체를 플레이어로 듣는다(플레이리스트를 듣던 중이면 오늘로 바꾼다). 오늘을 듣는 중이면 일시정지 */
function ListenAll() {
  const p = usePlayer();
  const { audio } = useProfile();
  const cls = "btn btn-ink mt-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 px-4 text-[14px] no-underline";
  if (!audio) {
    return (
      <Link href="/premium" aria-label="오늘 소식 전체 듣기, Premium에서 들을 수 있어요" className={cls}>
        <IconPlay className="size-4" />
        전체 듣기
        <PremiumBadge />
      </Link>
    );
  }
  const playingToday = !p.playlist && p.status === "playing";
  // 음성 정보를 받기 전에도 누를 수 있다: 받는 대로 시작하고(그동안 도는 고리), 못 받았으면 다시 받아 시작한다
  return (
    <button
      type="button"
      onClick={() => (playingToday ? p.pause() : p.playToday())}
      aria-busy={p.starting || undefined}
      aria-label={playingToday ? "오늘 소식 듣기 일시정지" : "오늘 소식 전체 듣기"}
      className={cls}
    >
      {p.starting ? <Spinner /> : playingToday ? <IconPause className="size-4" /> : <IconPlay className="size-4" />}
      {playingToday ? "일시정지" : "전체 듣기"}
    </button>
  );
}
