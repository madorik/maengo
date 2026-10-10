"use client";

import { createContext, useContext, useState } from "react";
import { IconHeadphones, IconPlay } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { PLAYLIST_MAX } from "@/lib/playlist";

// 보관함 플레이리스트(Premium). '골라 듣기'를 누르고 카드를 고르면 고른 순서대로 번호가 붙고, 제목 줄의 'n개 듣기'로 이어 듣는다.
// 고르는 동안 제목 줄은 화면 위(상단바 아래)에 붙어 있어 아래로 내려가도 바로 누를 수 있고, 오른쪽 아래 듣기 창을 가리지 않는다.
// 재생은 오늘 듣기와 같은 플레이어(PlayerProvider.playPlaylist)라 화면을 옮겨도 이어지고, 오른쪽 아래 듣기 창에서 조작한다.
// 고른 것은 쪽·카테고리를 옮겨도 남는다(보관함 화면 안에서는 이 Provider가 그대로 유지된다).

interface PickApi {
  picking: boolean;
  /** 고른 소식(고른 순서) */
  ids: number[];
  full: boolean;
  setPicking: (on: boolean) => void;
  toggle: (id: number) => void;
}

const PickContext = createContext<PickApi | null>(null);

function usePick(): PickApi {
  const ctx = useContext(PickContext);
  if (!ctx) throw new Error("usePick은 PlaylistPicker 안에서만 쓸 수 있어요");
  return ctx;
}

export function PlaylistPicker({ children }: { children: React.ReactNode }) {
  const [picking, setPickingState] = useState(false);
  const [ids, setIds] = useState<number[]>([]);
  const api: PickApi = {
    picking,
    ids,
    full: ids.length >= PLAYLIST_MAX,
    setPicking: (on) => {
      setPickingState(on);
      if (!on) setIds([]);
    },
    toggle: (id) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= PLAYLIST_MAX ? prev : [...prev, id])),
  };
  return <PickContext.Provider value={api}>{children}</PickContext.Provider>;
}

/** 보관함 제목 줄. 고르는 동안은 위에 붙고 '취소'·'n개 듣기'가 된다. Free는 '골라 듣기'를 Premium 배지와 함께 막아 둔다 */
export function LibraryHeader({ total }: { total: number }) {
  const profile = useProfile();
  const pick = usePick();
  const p = usePlayer();
  const n = pick.ids.length;
  const play = () => {
    p.playPlaylist(pick.ids);
    pick.setPicking(false);
  };

  let controls: React.ReactNode = null;
  if (total > 0 && !profile.audio) {
    controls = (
      <span aria-disabled="true" title="골라 듣기는 Premium에서 쓸 수 있어요" className="inline-flex min-h-11 cursor-not-allowed items-center gap-1.5 text-[14px] font-extrabold text-faint">
        <IconHeadphones className="size-4" />
        골라 듣기
        <PremiumBadge />
      </span>
    );
  } else if (pick.picking) {
    controls = (
      <span className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => pick.setPicking(false)} className="btn btn-ghost min-h-11 px-4 text-[14px]">
          취소
        </button>
        <button type="button" onClick={play} disabled={!n} className="btn btn-sky inline-flex min-h-11 items-center gap-1.5 px-4 text-[14px]">
          <IconPlay className="size-4" />
          {n ? `${n}개 듣기` : "듣기"}
        </button>
      </span>
    );
  } else if (total > 0) {
    controls = (
      <button type="button" onClick={() => pick.setPicking(true)} className="btn btn-ghost inline-flex min-h-11 items-center gap-1.5 px-4 text-[14px]">
        <IconHeadphones className="size-4" />
        골라 듣기
      </button>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-3 px-1 ${
        // 상단바(모바일 56px + 테두리) 아래에 붙인다. 데스크톱은 상단바가 없다
        pick.picking ? "sticky top-[calc(58px+env(safe-area-inset-top))] z-30 -mx-4 border-b-2 border-line bg-white px-5 py-2 lg:top-0" : ""
      }`}
    >
      <h1 className="text-[28px] font-black tracking-[-0.03em]">
        보관함 <span className="font-round text-[20px] text-faint">{total}</span>
      </h1>
      {controls}
      {pick.full && (
        <p role="status" className="basis-full pb-1 text-[13px] font-bold text-mango-deep">
          한 번에 {PLAYLIST_MAX}개까지 고를 수 있어요
        </p>
      )}
    </div>
  );
}

/** 고르는 중에 카드 위에 덮는 고르기 버튼. 고른 카드에는 고른 순서가 붙는다(카드의 읽음 표시는 data-pick으로 감춘다) */
export function PickTarget({ id, title }: { id: number; title: string }) {
  const pick = usePick();
  if (!pick.picking) return null;
  const order = pick.ids.indexOf(id) + 1;
  const on = order > 0;
  return (
    <button
      type="button"
      data-pick
      aria-pressed={on}
      aria-label={on ? `${title}, ${order}번째` : title}
      onClick={() => pick.toggle(id)}
      disabled={!on && pick.full}
      className={`absolute inset-0 z-10 rounded-2xl disabled:cursor-not-allowed ${on ? "bg-sky-tint mix-blend-multiply ring-2 ring-sky ring-inset" : "enabled:hover:bg-snow enabled:hover:mix-blend-multiply"}`}
    >
      <span
        className={`absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border-2 font-round text-[15px] font-black ${on ? "border-sky bg-sky text-white" : "border-line bg-white"}`}
      >
        {on ? order : ""}
      </span>
    </button>
  );
}
