"use client";

import Link from "next/link";
import { useTransition } from "react";
import { playlistClear, playlistMove, playlistRemove } from "@/app/actions";
import { IconChevronDown, IconClose, IconDoc, IconPlay } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { ReadBadge } from "@/components/library/ReadBadge";
import { Bubble } from "@/components/ui/Bubble";
import { CategoryChip } from "@/components/ui/CategoryChip";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { PLAYLIST_MAX } from "@/lib/playlist";
import type { LibraryEntry } from "@/lib/types";

/** 플레이리스트 화면: 담은 순서대로 전체 듣기, 칸마다 위·아래로 옮기기와 빼기, 비우기 */
export function PlaylistView({ entries, locked }: { entries: LibraryEntry[]; locked: boolean }) {
  const p = usePlayer();
  const [busy, start] = useTransition();
  const ids = entries.map((e) => e.clusterId);

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 lg:py-10">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1">
        <h1 className="text-[28px] font-black tracking-[-0.03em]">
          플레이리스트 <span className="font-round text-[20px] text-faint">{locked ? "" : `${entries.length}/${PLAYLIST_MAX}`}</span>
        </h1>
        {entries.length > 0 && (
          <span className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => start(() => playlistClear())} disabled={busy} className="btn btn-ghost min-h-11 px-4 text-[14px]">
              비우기
            </button>
            <button type="button" onClick={() => p.playPlaylist(ids)} className="btn btn-sky inline-flex min-h-11 items-center gap-1.5 px-4 text-[14px]">
              <IconPlay className="size-4" />
              전체 듣기
            </button>
          </span>
        )}
      </div>

      {locked ? (
        <div className="mt-10 flex items-end gap-3">
          <Mascot mood="listen" className="size-24 shrink-0" />
          <Bubble className="mb-6 flex-1">
            <p className="text-[16px] font-bold leading-relaxed">플레이리스트는 Premium에서 쓸 수 있어요.</p>
            <Link href="/premium" className="mt-2 inline-flex items-center gap-1 text-[15px] font-extrabold text-sky">
              Premium 알아보기
              <PremiumBadge />
            </Link>
          </Bubble>
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-10 flex items-end gap-3">
          <Mascot className="size-24 shrink-0" />
          <Bubble className="mb-6 flex-1">
            <p className="text-[16px] font-bold leading-relaxed">보관함 &lsquo;골라 듣기&rsquo;에서 소식을 골라 담아 보세요.</p>
            <Link href="/library" className="mt-2 inline-block text-[15px] font-extrabold text-sky">
              보관함으로 가기
            </Link>
          </Bubble>
        </div>
      ) : (
        <ol className="mt-6 flex flex-col gap-3">
          {entries.map((e, i) => (
            <li key={e.clusterId} className="tile relative flex items-start gap-3 p-4">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-tint font-round text-[15px] font-black text-sky-dark">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px] font-extrabold">
                  <CategoryChip category={e.category} />
                  <span className="inline-flex min-w-0 items-center gap-1 truncate text-sub">
                    <IconDoc className="size-3.5 shrink-0" />
                    {e.sourceLabel}
                  </span>
                  <span className="ml-auto shrink-0">
                    <ReadBadge clusterId={e.clusterId} read={e.read || e.listened} />
                  </span>
                </div>
                <h2 className="mt-2 text-[16px] font-black leading-snug tracking-[-0.02em]">
                  <Link href={`/article/${e.clusterId}`} className="no-underline">
                    {e.title}
                  </Link>
                </h2>
                <div className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${e.title} 위로`}
                    onClick={() => start(() => playlistMove(e.clusterId, -1))}
                    disabled={busy || i === 0}
                    className="inline-flex size-10 items-center justify-center rounded-xl text-sub hover:bg-snow disabled:text-line"
                  >
                    <IconChevronDown className="size-5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${e.title} 아래로`}
                    onClick={() => start(() => playlistMove(e.clusterId, 1))}
                    disabled={busy || i === entries.length - 1}
                    className="inline-flex size-10 items-center justify-center rounded-xl text-sub hover:bg-snow disabled:text-line"
                  >
                    <IconChevronDown className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`${e.title} 빼기`}
                    onClick={() => start(() => playlistRemove(e.clusterId))}
                    disabled={busy}
                    className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-[14px] font-extrabold text-sub hover:bg-snow"
                  >
                    <IconClose className="size-4" />
                    빼기
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
