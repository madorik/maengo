"use client";

import { track } from "@/lib/analytics";
import type { FeedbackKind } from "@maengo/core/types";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSwipeSurface } from "@/components/app/SwipePager";
import { IconExternal, IconNext, IconThumbDown, IconThumbUp } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { useToday } from "@/components/providers/TodayProvider";
import { SourceChip } from "@/components/today/TodayList";
import { Bubble } from "@/components/ui/Bubble";
import { BackButton } from "@/components/ui/BackButton";
import { CategoryChip } from "@/components/ui/CategoryChip";
import type { FeedItem } from "@/lib/types";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { singleStarted, viaTodayPlayer } from "@/lib/player/route";
import { ListenBar } from "./ListenBar";
import { PlaylistButton } from "./PlaylistButton";
import { ShareButton } from "./ShareButton";
import { useItemAudio } from "./useItemAudio";
import { useTodayAudio } from "./useTodayAudio";
import { VideoThumb } from "./VideoThumb";

// 좋아요 = 이 분야 가중치를 올린다(more), 싫어요 = 가중치를 내리고 이 소식을 다시 주지 않는다(skip).
// 예전의 "이미 알아요"(known)는 화면에서 뺐다. 서버는 예전 값도 그대로 받는다.
// 누른 상태는 버튼 모양(aria-pressed)으로만 보인다(확인 문장은 두지 않는다)
const CHOICES: { kind: FeedbackKind; label: string; Icon: typeof IconThumbUp }[] = [
  { kind: "more", label: "좋아요", Icon: IconThumbUp },
  { kind: "skip", label: "싫어요", Icon: IconThumbDown },
];

/**
 * 상세: 전체 글, 출처 링크, 영상이면 썸네일. 듣는 동안 지금 읽는 문단을 짚어 준다.
 * 오늘 글은 오늘 전체 음성이 이미 있거나 전체 듣기가 돌고 있으면 오늘 플레이어로 듣는다.
 * 그 밖(지난 글, 아직 전체 음성이 없는 오늘 글)은 그 글 하나짜리 파일로 듣는다. 글 하나 들으려고 오늘 소식 전부의 음성을 만들지 않게.
 */
export function ArticleView({ item: fromServer, isToday, inPlaylist }: { item: FeedItem; isToday: boolean; inPlaylist: boolean }) {
  const { data, feedback, markRead, setFeedback, listenAccess, listened } = useToday();
  const index = isToday ? data.items.findIndex((i) => i.clusterId === fromServer.clusterId) : -1;
  // 오늘 글은 플랜 전환 등으로 바뀐 최신 내용을 쓴다
  const item = data.items[index] ?? fromServer;
  const next = index >= 0 ? data.items[index + 1] : undefined;

  const p = usePlayer();
  // 플레이어 목록에 없는 오늘 글(듣는 동안 새로 받은 소식)은 글 하나 듣기로.
  // 에피소드 정보를 받기 전에 누른 글 하나 듣기는 정보가 와도 끊지 않는다(lib/player/route.ts)
  const inPlayer = index >= 0 && p.chapters.some((c) => c.clusterId === item.clusterId);
  const today = useTodayAudio(index >= 0 ? item.clusterId : -1, next);
  // Premium이거나 Free의 오늘 듣기 몫(하루 1개, 2026-10-23)이면 이 글 하나를 듣는다
  const access = listenAccess(item.clusterId);
  const single = useItemAudio(item.clusterId, access !== null);
  const singleBusy = singleStarted(single.ctl);
  const viaPlayer = viaTodayPlayer({
    inPlayer,
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
  // 들을 수 없으면(Free가 오늘 몫을 다 씀) 오늘 쪽 막대가 잠금 안내를 보여 준다
  const audio = viaPlayer || access === null ? today : single;
  const activePara = audio.activePara;
  const playing = audio.ctl.state === "playing";

  // 글을 열면 읽음으로 친다
  const id = item.clusterId;
  useEffect(() => {
    track("item_open", { category: item.category, kind: item.kind, today: index >= 0 });
    // 소식이 바뀔 때만 센다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    markRead(id);
  }, [id, markRead]);

  const paraRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  useEffect(() => {
    if (!playing || activePara === undefined) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    paraRefs.current[activePara]?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [activePara, playing]);

  // 앱에서는 본문을 좌우로 밀어 이전·다음 글로 넘긴다(article/layout.tsx의 ArticleSwipe). 머리말과 듣기 막대는 제자리에 둔다
  const swipeRef = useSwipeSurface();

  const fb = feedback[item.clusterId];
  const sourceLink = item.kind === "video" ? "유튜브에서 보기" : "원문 보기";

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-10 border-b-2 border-line bg-paper pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[720px] items-center gap-2 px-2">
          {/* 들어온 화면(오늘·보관함·다른 글)으로 돌아간다. 바로 열었으면 오늘이나 보관함으로 */}
          <BackButton fallback={isToday ? "/today" : "/library"} />
          <span className="ml-auto pr-1 font-round text-[15px] font-black text-faint">
            {index >= 0 ? `${index + 1}/${data.items.length}` : ""}
          </span>
          <ShareButton item={item} />
        </div>
      </header>

      {/* 아래 여백: '이 글 듣기' 막대(높이는 ListenBar가 --listen-bar-h로 남긴다) + 그 위 플레이어 버튼만큼 */}
      <main ref={swipeRef} className="mx-auto max-w-[680px] px-5 pb-[calc(var(--listen-bar-h,104px)+88px)] pt-6">
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

        {/* 출처: 어느 매체인지만. 매체 이름을 누르면 원문이 열린다 */}
        <p className="mt-8 text-[15px] font-semibold text-sub">
          출처{" "}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("source_open", { category: item.category, kind: item.kind })}
            className="inline-flex items-center gap-1 font-extrabold text-ink underline-offset-4 hover:underline"
          >
            {item.sourceLabel}
            <IconExternal className="size-4" />
            <span className="sr-only">{sourceLink}(새 탭에서 열림)</span>
          </a>
        </p>

        <PlaylistButton clusterId={item.clusterId} initial={inPlaylist} />

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

      {/* 오늘 몫을 쓰게 되는 처음 듣는 글이면 버튼에 '오늘 무료'를 붙인다 */}
      <ListenBar ctl={audio.ctl} free={access === "free" && !listened.has(item.clusterId)} />
    </div>
  );
}
