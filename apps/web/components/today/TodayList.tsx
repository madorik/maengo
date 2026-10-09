"use client";

import Link from "next/link";
import { IconCheck, IconDoc, IconPause, IconPlay, IconSpeaker } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { Bubble } from "@/components/ui/Bubble";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { FeedItem } from "@/lib/types";

/** 오늘 목록: 제목·요약·출처·작성자·작성일. 누르면 전체 글로 */
export function TodayList() {
  const { data, game } = useToday();
  return (
    <div className="mx-auto max-w-[640px] px-4 pt-5 lg:pt-8">
      <div className="min-w-0">
        <section aria-labelledby="today-title" className="rounded-2xl bg-mango px-5 pb-4 pt-4 shadow-[0_4px_0_var(--color-mango-dark)]">
          <p className="text-[13px] font-extrabold text-ink/70">{data.greetingDate}</p>
          <h1 id="today-title" className="mt-0.5 text-[24px] font-black tracking-[-0.03em]">
            오늘의 맹고 {game.total}개
          </h1>
          {game.total > 0 && (
            <p className="mt-1 text-[14px] font-semibold leading-snug text-ink/80">
              {data.jobLabel}에게 맞춰 {data.topicNames.join(", ")}에서 골랐어요
            </p>
          )}
          {game.total > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <ProgressBar value={game.done / game.total} tone="leaf" label="오늘 읽은 소식" className="h-4 flex-1" track="bg-white/60" />
              <span className="font-round text-[17px] font-black">
                {game.done}/{game.total}
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
          <div className="mt-10 flex items-end gap-3">
            <Mascot className="size-24 shrink-0" />
            <Bubble className="mb-6 flex-1">
              <p className="text-[15px] font-bold leading-relaxed">관심 토픽에서 아직 안 본 소식을 다 썼어요. 토픽을 넓히면 더 골라 드릴 수 있어요.</p>
              <Link href="/settings#topics" className="mt-2 inline-block text-[15px] font-extrabold text-sky">
                관심 토픽 고치기
              </Link>
            </Bubble>
          </div>
        )}

        {data.hiddenCount > 0 && (
          <div className="tile mt-4 flex flex-col gap-4 border-dashed p-5 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3">
              <Mascot mood="listen" className="size-14 shrink-0" />
              <div>
                <p className="text-[16px] font-black">오늘 고른 소식이 {data.hiddenCount}개 더 있어요</p>
                <p className="mt-0.5 text-[14px] font-semibold text-sub">무료는 하루 {data.dailyLimit}개, 플러스는 하루 최대 10개를 받아요.</p>
              </div>
            </div>
            <Link href="/settings#plan" className="btn shrink-0">
              플러스로 다 보기
            </Link>
          </div>
        )}

        {game.total > 0 && (
          <div className="mt-10 flex items-end gap-3">
            <Mascot mood={game.allDone ? "cheer" : "happy"} className="size-24 shrink-0" />
            <Bubble className="mb-6 flex-1">
              <p className="text-[15px] font-bold leading-relaxed">
                {game.allDone
                  ? `오늘은 여기까지예요! 내일 ${data.notifyLabel}에 새로 고른 소식으로 만나요.`
                  : `${game.total - game.done}개 남았어요. 다 보면 오늘은 끝이에요. 나머지 소식은 몰라도 괜찮아요.`}
              </p>
            </Bubble>
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleCard({ item, index }: { item: FeedItem; index: number }) {
  const { consumed } = useToday();
  const p = usePlayer();
  const done = consumed(item.clusterId);
  const current = p.cur === index && p.status !== "done";
  const playing = current && p.status === "playing";

  return (
    <li className={`tile relative p-4 transition-colors hover:bg-snow sm:p-5 ${current ? "border-sky" : ""}`}>
      <div className="flex items-center gap-2 text-[13px] font-extrabold">
        <CategoryChip category={item.category} />
        <SourceChip item={item} />
        {item.coverage && item.kind === "article" && <span className="hidden truncate font-bold text-sub sm:inline">{item.coverage}</span>}
        <span className="ml-auto shrink-0">
          {playing ? (
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
        {p.enabled && (
          <button
            type="button"
            onClick={() => (playing ? p.pause() : p.playOne(index))}
            disabled={!p.ready}
            aria-label={playing ? `${item.title} 그만 듣기` : `${item.title} 듣기`}
            className="btn btn-ghost relative z-10 ml-auto min-h-10 shrink-0 px-3 text-[14px]"
          >
            {playing ? <IconPause className="size-4 text-sky" /> : <IconSpeaker className="size-5 text-sky" />}
            {playing ? "멈춤" : "듣기"}
          </button>
        )}
      </div>
    </li>
  );
}

export function SourceChip({ item }: { item: FeedItem }) {
  const video = item.kind === "video";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[13px] font-extrabold ${video ? "bg-[#FFE9E6] text-[#B8321F]" : "bg-sky-tint text-sky-dark"}`}>
      {video ? <IconPlay className="size-3.5" /> : <IconDoc className="size-3.5" />}
      {item.sourceLabel}
    </span>
  );
}
