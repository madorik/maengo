import Image from "next/image";
import { IconPlay } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import type { FeedItem } from "@/lib/types";

const DEMO_BG = ["#2B2F4A", "#14385C", "#3A2350", "#1E4636"];

/** 유튜브 썸네일. 누르면 유튜브에서 영상이 열린다 */
export function VideoThumb({ item }: { item: FeedItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative mt-6 block aspect-video overflow-hidden rounded-2xl border-2 border-line bg-ink no-underline"
    >
      {item.thumbnail ? (
        <>
          <Image src={item.thumbnail} alt="" fill sizes="(max-width: 720px) 100vw, 680px" className="object-cover" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-20 items-center justify-center rounded-2xl bg-black/70 text-white transition-transform group-hover:scale-105">
              <IconPlay className="size-8" />
            </span>
          </span>
        </>
      ) : (
        // 데모 영상은 실제 영상 ID가 없어서 썸네일을 그려서 보여 준다
        <span aria-hidden="true" className="absolute inset-0 flex items-center gap-3 p-5 sm:p-8" style={{ background: DEMO_BG[item.clusterId % DEMO_BG.length] }}>
          <span className="block min-w-0 flex-1">
            <span className="block text-[12px] font-extrabold text-white/70 sm:text-[14px]">{item.author}</span>
            <span className="mt-1 block text-[19px] font-black leading-tight text-white sm:text-[28px]">{item.title}</span>
          </span>
          <Mascot mood="listen" className="size-20 shrink-0 sm:size-32" />
          <span className="absolute bottom-3 right-3 flex h-10 w-14 items-center justify-center rounded-xl bg-black/70 text-white transition-transform group-hover:scale-105 sm:bottom-5 sm:right-5">
            <IconPlay className="size-6" />
          </span>
        </span>
      )}
      <span className="sr-only">유튜브에서 영상 보기 (새 탭에서 열림)</span>
    </a>
  );
}
