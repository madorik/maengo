"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { playlistAdd } from "@/app/actions";
import { IconCheck, IconHeadphones, IconPlay } from "@/components/icons";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";

// 보관함 골라 듣기(Premium). '골라 듣기'를 누르고 소식을 고르면 왼쪽 둥근 자리에 망고 원(고른 차례 번호)이 붙는다. 듣기·담기는 고른 순서대로(2026-10-15 정리: 위는 선택, 아래는 동작).
//   위(제목 줄): '골라 듣기' 알약이 남색으로 켜진다(다시 누르면 그만둔다). 목록 위에 'n개 선택' · '전체 선택'(지금 거른 소식 전부. 안 읽은 것만은 '안 읽음'으로 거른 뒤 전체)이 붙는다
//   아래(고르는 동안 고정 막대, 2026-11-26 시안): 망고 주 버튼 'n개 듣기'(0개면 회색) · 테두리 알약 '플레이리스트에 담기'
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

/** 지금 골라 듣기로 고르는 중인지(소식 줄이 왼쪽에 체크 자리를 비운다) */
export function usePicking(): boolean {
  return usePick().picking;
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

/**
 * 보관함 제목 줄(2026-11-26 시안): 큰 제목 '보관함' + 오른쪽 '골라 듣기' 알약. 고르는 동안은 알약이 남색으로 켜지고 다시 누르면 그만둔다.
 * Free는 '골라 듣기'를 Premium 배지와 함께 막아 둔다. 예전 제목 줄의 '북마크' 거르기는 아래 보기 칩(전체·안 읽음·북마크)으로 옮겼다
 */
export function LibraryHeader({ total }: { total: number }) {
  const profile = useProfile();
  const pick = usePick();
  const pill = "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[14px] font-bold no-underline";
  return (
    <header className="flex min-h-10 items-center gap-3">
      <h1 className="flex-1 text-[28px] font-extrabold tracking-[-0.05em]">보관함</h1>
      {total > 0 &&
        (!profile.audio ? (
          <Link href="/premium" aria-label="골라 듣기, Premium에서 쓸 수 있어요" className={`${pill} border-line bg-snow text-ink hover:bg-line`}>
            <IconHeadphones className="size-[17px]" />
            골라 듣기
            <PremiumBadge />
          </Link>
        ) : (
          <button
            type="button"
            aria-pressed={pick.picking}
            onClick={() => pick.setPicking(!pick.picking)}
            className={`${pill} ${pick.picking ? "border-ink bg-ink text-paper" : "border-line bg-snow text-ink hover:bg-line"}`}
          >
            <IconHeadphones className="size-[17px]" />
            골라 듣기
          </button>
        ))}
    </header>
  );
}

/**
 * 고르는 동안 목록 위에 붙는 줄: 'n개 선택' · '전체 선택'(지금 거른 소식 전부, 모든 쪽). 스크롤해도 상단바 아래에 붙어 있다.
 * 예전엔 ✕ · n개 선택 · ☐ 전체가 제목 줄을 대신했다. 시안에서는 제목 줄의 남색 알약이 그만두기를 맡는다(2026-11-26)
 */
export function PickSummary({ pickIds }: { pickIds: number[] }) {
  const pick = usePick();
  if (!pick.picking) return null;
  const n = pick.ids.length;
  const all = pickIds.length > 0 && n === pickIds.length && pickIds.every((id, i) => pick.ids[i] === id);
  return (
    // 상단바(모바일 56px + 테두리) 아래에 붙인다. 데스크톱은 상단바가 없다
    <div className="sticky top-[calc(58px+env(safe-area-inset-top))] z-30 -mx-5 flex items-center gap-3 bg-paper px-5 py-2 lg:top-0">
      <p aria-live="polite" className="flex-1 text-[15px] font-extrabold tracking-[-0.03em]">
        {n ? `${n}개 선택` : "소식을 골라 주세요"}
      </p>
      <button
        type="button"
        onClick={() => pick.pickMany(all ? [] : pickIds)}
        disabled={!pickIds.length}
        aria-pressed={all}
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] disabled:text-faint ${
          all ? "border-ink bg-ink font-bold text-paper" : "border-line-dark font-semibold text-ink"
        }`}
      >
        {all && <IconCheck className="size-4 [stroke-width:3]" />}
        전체 선택
      </button>
    </div>
  );
}

/**
 * 고르는 동안 화면 아래에 뜨는 고정 막대(2026-11-26 시안): 망고 주 버튼 'n개 듣기'(고른 게 없으면 회색 '소식을 골라 주세요') · 테두리 알약 '플레이리스트에 담기'.
 * 막대만큼 목록 아래에 빈 칸을 둔다. 고르는 동안은 떠 있는 플레이어를 숨긴다(html[data-picking])
 * 모바일은 아래 메뉴(--tabbar-h) 바로 위에 뜬다(2026-11-26 메뉴를 아래로 내림)
 */
export function PickBar() {
  const pick = usePick();
  const p = usePlayer();
  const [adding, startAdd] = useTransition();
  const n = pick.ids.length;
  // 고르는 동안은 떠 있는 플레이어를 숨긴다(아래 막대와 겹친다, globals.css html[data-picking])
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-picking", pick.picking);
    return () => root.removeAttribute("data-picking");
  }, [pick.picking]);
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
      <div className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-50 bg-gradient-to-b from-transparent to-paper to-40% px-4 pb-[max(12px,calc(env(safe-area-inset-bottom)+16px-var(--tabbar-h)))] pt-7">
        <div className="mx-auto flex max-w-[680px] items-center gap-2">
          {/* 고른 것만 고른 차례대로 이어 듣기(2026-11-10 사용자) */}
          <button type="button" onClick={play} disabled={n === 0} aria-label={n ? `고른 ${n}개 듣기` : undefined} className="btn h-[54px] flex-1 px-4 font-extrabold">
            {n > 0 && <IconPlay className="size-[15px]" />}
            {n ? `${n}개 듣기` : "소식을 골라 주세요"}
          </button>
          <button
            type="button"
            onClick={add}
            disabled={adding || n === 0}
            className="h-[54px] flex-1 rounded-full border border-line-dark bg-paper px-4 text-[15px] font-bold text-ink shadow-[0_4px_16px_rgb(31_35_64/0.08)] disabled:text-faint"
          >
            플레이리스트에 담기
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * 고르는 중에 소식 위에 덮는 고르기 버튼(2026-11-26 시안). row는 줄 왼쪽에 둥근 체크 자리가 나오고(줄이 비워 둔다, usePicking),
 * card(큰 사진 카드)는 사진 왼쪽 위에 얹힌다. 고르면 망고 노랑 원이 되고, 안에 고른 차례 번호가 든다(고른 차례대로 듣는다, 2026-11-10).
 * 줄의 북마크는 inert로 눌리지 않게 두고 모양은 그대로 보인다. 덮개는 글자 위에 얹히므로 아무것도 칠하지 않는다(섞기 모드 multiply는 다크에서 카드를 거의 검게 만든다)
 */
export function PickTarget({ id, title, shape = "row" }: { id: number; title: string; shape?: "row" | "card" }) {
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
      className={`absolute inset-0 z-10 ${shape === "card" ? `rounded-3xl ${on ? "ring-2 ring-mango ring-inset" : ""}` : ""}`}
    >
      <span
        // 망고 위 글자는 다크에서도 남색(--color-ink가 밝아져서 text-ink를 쓰지 않는다)
        className={`absolute flex size-[26px] items-center justify-center rounded-full border-2 ${shape === "card" ? "left-3 top-3" : "left-0 top-1/2 -translate-y-1/2"} ${
          on ? "border-mango bg-mango text-[#1F2340]" : "border-line-dark bg-paper"
        }`}
      >
        {on && <span className="font-round text-[13px] font-black leading-none">{pick.ids.indexOf(id) + 1}</span>}
      </span>
    </button>
  );
}
