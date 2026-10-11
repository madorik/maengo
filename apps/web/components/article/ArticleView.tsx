"use client";

import type { FeedbackKind } from "@maengo/core/types";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { IconBack, IconExternal, IconNext, IconThumbDown, IconThumbUp } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { useProfile } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { SourceChip } from "@/components/today/TodayList";
import { Bubble } from "@/components/ui/Bubble";
import { CategoryChip } from "@/components/ui/CategoryChip";
import type { FeedItem } from "@/lib/types";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { ListenBar } from "./ListenBar";
import { useItemAudio } from "./useItemAudio";
import { useTodayAudio } from "./useTodayAudio";
import { VideoThumb } from "./VideoThumb";

// 좋아요 = 이 분야 가중치를 올린다(more), 싫어요 = 가중치를 내리고 이 소식을 다시 주지 않는다(skip).
// 예전의 "이미 알아요"(known)는 화면에서 뺐다. 서버는 예전 값도 그대로 받는다.
const CHOICES: { kind: FeedbackKind; label: string; note: string; Icon: typeof IconThumbUp }[] = [
  { kind: "more", label: "좋아요", note: "이 분야 소식을 더 자주 골라 드릴게요.", Icon: IconThumbUp },
  { kind: "skip", label: "싫어요", note: "이런 소식은 덜 골라 드릴게요.", Icon: IconThumbDown },
];

/**
 * 상세: 전체 글, 출처 링크, 영상이면 썸네일. 듣는 동안 지금 읽는 문단을 짚어 준다.
 * 오늘 글은 오늘 전체 음성이 이미 있거나 전체 듣기가 돌고 있으면 오늘 브리핑 플레이어로 듣는다.
 * 그 밖(지난 글, 아직 전체 음성이 없는 오늘 글)은 그 글 하나짜리 파일로 듣는다. 글 하나 들으려고 오늘 소식 전부의 음성을 만들지 않게.
 */
export function ArticleView({ item: fromServer, isToday }: { item: FeedItem; isToday: boolean }) {
  const { data, feedback, markRead, setFeedback } = useToday();
  const profile = useProfile();
  const index = isToday ? data.items.findIndex((i) => i.clusterId === fromServer.clusterId) : -1;
  // 오늘 글은 플랜 전환 등으로 바뀐 최신 내용을 쓴다
  const item = data.items[index] ?? fromServer;
  const next = index >= 0 ? data.items[index + 1] : undefined;

  const p = usePlayer();
  const viaPlayer = index >= 0 && !p.playlist && (p.audioReady || p.preparing || p.status !== "idle");
  const today = useTodayAudio(index, next);
  const single = useItemAudio(item.clusterId, profile.audio && !viaPlayer);
  // 무료면 오늘 쪽 막대가 잠금 안내를 보여 준다
  const audio = viaPlayer || !profile.audio ? today : single;
  const activePara = audio.activePara;
  const playing = audio.ctl.state === "playing";

  // 글을 열면 읽음으로 친다
  const id = item.clusterId;
  useEffect(() => {
    markRead(id);
  }, [id, markRead]);

  const paraRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  useEffect(() => {
    if (!playing || activePara === undefined) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    paraRefs.current[activePara]?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [activePara, playing]);

  const fb = feedback[item.clusterId];
  const sourceLink = item.kind === "video" ? "유튜브에서 보기" : "원문 보기";

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-10 border-b-2 border-line bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[720px] items-center gap-2 px-2">
          <Link
            href={isToday ? "/today" : "/library"}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-[15px] font-extrabold text-sub no-underline hover:bg-snow"
          >
            <IconBack />
            {isToday ? "오늘" : "보관함"}
          </Link>
          <span className="ml-auto pr-2 font-round text-[15px] font-black text-faint">
            {index >= 0 ? `${index + 1}/${data.items.length}` : ""}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[680px] px-5 pb-44 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip category={item.category} />
          <SourceChip item={item} />
          {item.coverage && item.kind === "article" && <span className="text-[13px] font-bold text-sub">{item.coverage}</span>}
        </div>
        <h1 className="mt-3 text-[26px] font-black leading-[1.3] tracking-[-0.03em] md:text-[32px]">{item.title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]">
          <span className="font-extrabold">{item.author}</span>
          <span className="font-semibold text-faint">{item.publishedLabel}</span>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-extrabold text-sky no-underline hover:underline">
            {sourceLink}
            <IconExternal className="size-4" />
            <span className="sr-only">(새 탭에서 열림)</span>
          </a>
        </p>

        {item.kind === "video" && <VideoThumb item={item} />}

        {/* 맹고가 말풍선으로 요약을 건넨다 */}
        <section aria-label="요약" className="mt-6 flex items-start gap-2">
          <Mascot className="size-14 shrink-0" />
          <Bubble className="flex-1">
            <p className="text-[17px] font-bold leading-[1.65]">{item.short}</p>
          </Bubble>
        </section>

        <article aria-label="전체 글" className="mt-8 flex flex-col gap-4">
          {item.body.map((para, i) => (
            <p
              key={i}
              ref={(el) => {
                paraRefs.current[i] = el;
              }}
              className={`-mx-3 scroll-mb-32 scroll-mt-20 rounded-xl px-3 py-1.5 text-[17px] font-medium leading-[1.85] transition-colors ${i === activePara ? "bg-sky-tint" : ""}`}
            >
              {para}
            </p>
          ))}
        </article>

        {item.scenes && (
          <section aria-labelledby="scenes-title" className="tile mt-8 p-4">
            <h2 id="scenes-title" className="text-[15px] font-black">
              영상에서 짚은 장면
            </h2>
            <ol className="mt-3 flex flex-col gap-1">
              {item.scenes.map((s) => (
                <li key={s.t}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-1 py-1.5 no-underline hover:bg-snow">
                    <span className="min-w-[60px] rounded-lg bg-sky-tint px-2 py-1 text-center font-round text-[14px] font-black text-sky-dark">{s.t}</span>
                    <span className="text-[15px] font-semibold">{s.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 출처: 한 줄(누가, 어느 매체, 언제 + 원문 링크) */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="tile mt-8 flex min-h-12 items-center gap-3 px-4 py-2.5 no-underline transition-colors hover:bg-snow"
        >
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-sub">
            {item.author && item.author !== item.sourceLabel && <span className="font-extrabold text-ink">{item.author}, </span>}
            {item.sourceLabel}, {item.publishedLabel}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[14px] font-extrabold">
            {sourceLink}
            <IconExternal className="size-4" />
          </span>
          <span className="sr-only">(새 탭에서 열림)</span>
        </a>

        <section aria-labelledby="fb-title" className="mt-8">
          <h2 id="fb-title" className="text-[17px] font-black">
            이 글 어땠어요?
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-[360px]">
            {CHOICES.map((c) => {
              const on = fb === c.kind;
              return (
                <button
                  key={c.kind}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFeedback(item.clusterId, on ? null : c.kind)}
                  className={`tile inline-flex min-h-12 items-center justify-center gap-2 px-4 text-[15px] font-extrabold ${on ? "border-sky bg-sky-tint text-sky-dark" : "hover:bg-snow"}`}
                >
                  <c.Icon className="size-5" />
                  {c.label}
                </button>
              );
            })}
          </div>
          <p aria-live="polite" className="mt-2 min-h-5 text-[14px] font-bold text-leaf">
            {CHOICES.find((c) => c.kind === fb)?.note ?? ""}
          </p>
        </section>

        {next ? (
          <Link href={`/article/${next.clusterId}`} className="tile mt-6 flex items-center gap-3 p-4 no-underline hover:bg-snow">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black text-sky">다음 글</span>
              <span className="mt-0.5 block truncate text-[16px] font-extrabold">{next.title}</span>
            </span>
            <IconNext className="size-6 text-faint" />
          </Link>
        ) : (
          <Link href={isToday ? "/today" : "/library"} className="btn btn-ghost mt-6 w-full">
            {isToday ? "오늘 목록으로" : "보관함으로"}
          </Link>
        )}
      </main>

      <ListenBar ctl={audio.ctl} />
    </div>
  );
}
