"use client";

import { createContext, useContext, useState } from "react";
import { IconHeadphones, IconPlay } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { PLAYLIST_MAX } from "@/lib/playlist";

// 보관함 플레이리스트(Premium). '골라 듣기'를 누르고 카드를 고르면 고른 순서대로 번호가 붙고, 아래 막대의 '듣기'로 이어 듣는다.
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
  return (
    <PickContext.Provider value={api}>
      {children}
      <PickBar />
    </PickContext.Provider>
  );
}

/** 제목 옆 '골라 듣기'(고르는 중에는 '취소'). Free는 Premium 배지와 함께 막아 둔다 */
export function PickButton() {
  const profile = useProfile();
  const pick = usePick();
  if (!profile.audio) {
    return (
      <span aria-disabled="true" title="골라 듣기는 Premium에서 쓸 수 있어요" className="inline-flex min-h-11 cursor-not-allowed items-center gap-1.5 text-[14px] font-extrabold text-faint">
        <IconHeadphones className="size-4" />
        골라 듣기
        <PremiumBadge />
      </span>
    );
  }
  return (
    <button type="button" onClick={() => pick.setPicking(!pick.picking)} aria-pressed={pick.picking} className="btn btn-ghost inline-flex min-h-11 items-center gap-1.5 px-4 text-[14px]">
      {!pick.picking && <IconHeadphones className="size-4" />}
      {pick.picking ? "취소" : "골라 듣기"}
    </button>
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

/** 고르는 중에 화면 아래에 뜨는 듣기 막대 */
function PickBar() {
  const pick = usePick();
  const p = usePlayer();
  if (!pick.picking) return null;
  const n = pick.ids.length;
  const play = () => {
    p.playPlaylist(pick.ids);
    pick.setPicking(false);
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-50 px-3 lg:bottom-6">
      <div className="rise tile pointer-events-auto mx-auto flex max-w-[648px] items-center gap-3 p-2 pl-4 shadow-[0_16px_48px_rgb(31_35_64/0.2)]">
        <p aria-live="polite" className="min-w-0 flex-1 text-[14px] font-bold text-mango-deep">
          {pick.full ? `한 번에 ${PLAYLIST_MAX}개까지 고를 수 있어요` : ""}
        </p>
        <button type="button" onClick={play} disabled={!n} className="btn btn-sky inline-flex min-h-12 shrink-0 items-center gap-1.5 px-5 text-[15px]">
          <IconPlay className="size-5" />
          {n ? `${n}개 듣기` : "듣기"}
        </button>
      </div>
    </div>
  );
}
