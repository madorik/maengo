"use client";

import Link from "next/link";
import { createContext, useContext, useState, useTransition } from "react";
import { playlistAdd } from "@/app/actions";
import { IconCheck, IconClose, IconHeadphones, IconPlay } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";

// 보관함 골라 듣기(Premium). '골라 듣기'를 누르고 카드를 고르면 체크가 붙는다. 듣기·담기는 고른 순서대로(2026-10-15 정리: 위는 선택, 아래는 동작).
//   위(제목 줄, 위에 붙음): ✕ 그만두기 · 'n개 선택' · ☐ 전체(지금 거른 소식 전부. 안 읽은 것만은 '안 읽음'으로 거른 뒤 전체)
//   아래(고른 게 있을 때만 고정 막대): 담기(플레이리스트로) · n개 듣기. 막대가 오른쪽 아래 듣기 창 자리를 덮는다
// 재생은 오늘 듣기와 같은 플레이어(PlayerProvider.playPlaylist)라 화면을 옮겨도 이어지고, 많으면 20개씩 이어 튼다.
// 고른 것은 쪽·카테고리를 옮겨도 남는다(보관함 화면 안에서는 이 Provider가 그대로 유지된다).

interface PickApi {
  picking: boolean;
  /** 고른 소식(고른 순서) */
  ids: number[];
  setPicking: (on: boolean) => void;
  toggle: (id: number) => void;
  /** 한꺼번에 고르기(전체). 개수 제한 없음 */
  pickMany: (ids: number[]) => void;
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
    setPicking: (on) => {
      setPickingState(on);
      if (!on) setIds([]);
    },
    toggle: (id) => setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    pickMany: (many) => setIds(many),
  };
  return <PickContext.Provider value={api}>{children}</PickContext.Provider>;
}

/** 보관함 제목 줄. 고르는 동안은 위에 붙고 ✕ · n개 선택 · ☐ 전체가 된다. Free는 '골라 듣기'를 Premium 배지와 함께 막아 둔다 */
export function LibraryHeader({ total, pickIds }: { total: number; pickIds: number[] }) {
  const profile = useProfile();
  const pick = usePick();
  const n = pick.ids.length;
  const all = pickIds.length > 0 && n === pickIds.length && pickIds.every((id, i) => pick.ids[i] === id);

  if (pick.picking) {
    return (
      // 상단바(모바일 56px + 테두리) 아래에 붙인다. 데스크톱은 상단바가 없다
      <div className="sticky top-[calc(58px+env(safe-area-inset-top))] z-30 -mx-4 flex items-center gap-2 border-b-2 border-line bg-paper px-3 py-2 lg:top-0">
        <h1 className="sr-only">보관함</h1>
        <button type="button" onClick={() => pick.setPicking(false)} aria-label="골라 듣기 그만두기" className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sub hover:bg-snow">
          <IconClose className="size-6" />
        </button>
        <p aria-live="polite" className="flex-1 text-[18px] font-black tracking-[-0.02em]">
          {n ? `${n}개 선택` : "선택"}
        </p>
        <button
          type="button"
          onClick={() => pick.pickMany(all ? [] : pickIds)}
          disabled={!pickIds.length}
          aria-pressed={all}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-[15px] font-extrabold hover:bg-snow disabled:text-faint"
        >
          <span className={`flex size-6 items-center justify-center rounded-md border-2 ${all ? "border-sky bg-sky text-white" : "border-line bg-paper"}`}>
            {all && <IconCheck className="size-4 [stroke-width:3.5]" />}
          </span>
          전체
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 px-1">
      <h1 className="text-[28px] font-black tracking-[-0.03em]">
        보관함 <span className="font-round text-[20px] text-faint">{total}</span>
      </h1>
      {total > 0 && !profile.audio ? (
        <Link href="/premium" aria-label="골라 듣기, Premium에서 쓸 수 있어요" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-extrabold text-faint no-underline">
          <IconHeadphones className="size-4" />
          골라 듣기
          <PremiumBadge />
        </Link>
      ) : total > 0 ? (
        <button type="button" onClick={() => pick.setPicking(true)} className="btn btn-ghost inline-flex min-h-11 items-center gap-1.5 px-4 text-[14px]">
          <IconHeadphones className="size-4" />
          골라 듣기
        </button>
      ) : null}
    </div>
  );
}

/** 고르는 동안 고른 게 있으면 화면 아래 고정 막대: 담기 · n개 듣기(엄지가 닿는 곳). 막대만큼 목록 아래에 빈 칸을 둔다 */
export function PickBar() {
  const pick = usePick();
  const p = usePlayer();
  const [adding, startAdd] = useTransition();
  const n = pick.ids.length;
  if (!pick.picking) return null;
  // 담으면 플레이리스트 화면으로 간다(playlistAdd가 옮겨 준다)
  const add = () => startAdd(() => playlistAdd(pick.ids));
  const play = () => {
    p.playPlaylist(pick.ids);
    pick.setPicking(false);
  };
  return (
    <>
      <div aria-hidden="true" className="h-24" />
      {n > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-line bg-paper px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-[680px] gap-3">
            <button type="button" onClick={add} disabled={adding} className="btn btn-ghost min-h-12 flex-1 text-[15px]">
              담기
            </button>
            <button type="button" onClick={play} className="btn btn-sky inline-flex min-h-12 flex-[2] items-center justify-center gap-1.5 text-[15px]">
              <IconPlay className="size-4" />
              {n}개 듣기
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** 고르는 중에 카드 위에 덮는 고르기 버튼. 고른 카드에는 체크가 붙는다(카드의 읽음 표시는 data-pick으로 감춘다) */
export function PickTarget({ id, title }: { id: number; title: string }) {
  const pick = usePick();
  if (!pick.picking) return null;
  const on = pick.ids.includes(id);
  return (
    <button
      type="button"
      data-pick
      aria-pressed={on}
      aria-label={title}
      onClick={() => pick.toggle(id)}
      className={`absolute inset-0 z-10 rounded-2xl disabled:cursor-not-allowed ${on ? "bg-sky-tint mix-blend-multiply ring-2 ring-sky ring-inset" : "enabled:hover:bg-snow enabled:hover:mix-blend-multiply"}`}
    >
      <span
        className={`absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border-2 ${on ? "border-sky bg-sky text-white" : "border-line bg-paper"}`}
      >
        {on && <IconCheck className="size-5 [stroke-width:3.5]" />}
      </span>
    </button>
  );
}
