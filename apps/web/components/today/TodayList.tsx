"use client";

import Link from "next/link";
import { IconCheck, IconDoc, IconPause, IconPlay, IconSpeaker } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { useItemAudio } from "@/components/article/useItemAudio";
import { MakeToday } from "./MakeToday";
import { MoreToday } from "./MoreToday";
import { TermsNotice } from "./TermsNotice";
import type { FeedItem } from "@/lib/types";

/** 오늘 목록: 제목·요약·출처·작성자·작성일. 누르면 전체 글로 */
export function TodayList() {
  const { data, game } = useToday();
  // 오늘 받은 소식 / 하루 소식(플랜). 지갑의 맹고로 더 받은 건 +N으로 붙인다
  const daily = useProfile().dailyItems;
  const received = Math.min(game.total, daily);
  const more = game.total - received;
  return (
    <div className="mx-auto max-w-[640px] px-4 pt-5 lg:pt-8">
      <div className="min-w-0">
        {data.termsNotice && <TermsNotice />}
        <section aria-labelledby="today-title" className="keep-light rounded-2xl bg-mango px-5 pb-4 pt-4 shadow-[0_4px_0_var(--color-mango-dark)]">
          <p className="text-[13px] font-extrabold text-ink/70">{data.greetingDate}</p>
          <h1 id="today-title" className="mt-0.5 text-[24px] font-black tracking-[-0.03em]">
            오늘의 소식 {game.total}개
          </h1>
          {game.total > 0 && (
            <p className="mt-1 text-[14px] font-semibold leading-snug text-ink/80">
              관심사 {data.topicNames.join(", ")}에서 골랐어요
            </p>
          )}
          {game.total > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <ProgressBar value={received / daily} tone="leaf" label="오늘 받은 소식" className="h-4 flex-1" track="bg-white/60" />
              <span className="font-round text-[17px] font-black">
                {received}/{daily}
                {more > 0 && ` +${more}`}
              </span>
            </div>
          )}
        </section>

        {game.total > 0 ? (
          <ol className="mt-6 flex flex-col gap-4" aria-label="오늘의 소식">
            {data.items.map((item, i) => (
              <ArticleCard key={item.clusterId} item={item} index={i} />
            ))}
          </ol>
        ) : (
          <MakeToday reason={data.emptyReason} notifyLabel={data.notifyLabel} />
        )}

        {game.total > 0 && <MoreToday cost={data.moreCost} kept={data.wallet} />}

      </div>
    </div>
  );
}

function ArticleCard({ item, index }: { item: FeedItem; index: number }) {
  const { consumed } = useToday();
  const p = usePlayer();
  const profile = useProfile();
  const done = consumed(item.clusterId);
  // 오늘 전체 음성이 이미 있거나 전체 듣기가 돌고 있으면 플레이어로, 아니면 이 소식 하나만 만들어 듣는다(플레이리스트를 듣는 중이면 하나만)
  const viaPlayer = !p.playlist && (p.audioReady || p.preparing || p.status !== "idle");
  const single = useItemAudio(item.clusterId, p.enabled && !viaPlayer);
  const current = viaPlayer ? p.cur === index && p.status !== "done" : single.ctl.state === "playing" || single.ctl.state === "paused";
  const preparing = viaPlayer ? current && p.preparing : !!single.ctl.preparing;
  const playing = !preparing && (viaPlayer ? current && p.status === "playing" : single.ctl.state === "playing");
  const listen = () => {
    if (viaPlayer) return playing ? p.pause() : p.playOne(index);
    return playing ? single.ctl.pause() : single.ctl.play();
  };

  return (
    <li className={`tile relative p-4 transition-colors hover:bg-snow sm:p-5 ${current ? "border-sky" : ""}`}>
      <div className="flex items-center gap-2 text-[13px] font-extrabold">
        <CategoryChip category={item.category} />
        <SourceChip item={item} />
        {item.coverage && item.kind === "article" && <span className="hidden truncate font-bold text-sub sm:inline">{item.coverage}</span>}
        <span className="ml-auto shrink-0">
          {!viaPlayer && single.ctl.error ? (
            <span className="text-orange">음성을 못 만들었어요</span>
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
        <Link href={`/article/${item.clusterId}`} className={`no-underline after:absolute after:inset-0 after:rounded-2xl ${done ? "text-sub" : ""}`}>
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
            className="relative z-10 ml-auto inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border-2 border-line px-3 text-[14px] font-extrabold text-faint no-underline hover:bg-snow"
          >
            <IconSpeaker className="size-5" />
            듣기
            <PremiumBadge />
          </Link>
        ) : p.enabled && (
          <button
            type="button"
            onClick={listen}
            disabled={!p.ready || preparing}
            aria-label={playing ? `${item.title} 그만 듣기` : `${item.title} 듣기`}
            className="btn btn-ghost relative z-10 ml-auto min-h-10 shrink-0 px-3 text-[14px]"
          >
            {playing ? <IconPause className="size-4 text-sky" /> : <IconSpeaker className="size-5 text-sky" />}
            {preparing ? "만드는 중" : playing ? "멈춤" : "듣기"}
          </button>
        )}
      </div>
    </li>
  );
}

export function SourceChip({ item }: { item: FeedItem }) {
  const video = item.kind === "video";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[13px] font-extrabold ${video ? "bg-[#FFE9E6] text-[#B8321F] tone [--tone:#B8321F]" : "bg-sky-tint text-sky-dark"}`}>
      {video ? <IconPlay className="size-3.5" /> : <IconDoc className="size-3.5" />}
      {item.sourceLabel}
    </span>
  );
}
