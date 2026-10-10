"use client";

import Link from "next/link";
import { BETA } from "@/lib/site";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions";
import { Crown, IconChevronDown } from "@/components/icons";
import { useProfile } from "@/components/providers/ProfileProvider";

/** 프로필 사진(구글 사진, 없으면 이름 첫 글자). Premium이면 동그라미 위에 왕관을 씌운다 */
function Avatar({ size, crown }: { size: "sm" | "md" | "lg"; crown: boolean }) {
  const p = useProfile();
  const initial = (p.displayName ?? p.email ?? "맹").trim().charAt(0).toUpperCase();
  const circle = { sm: "size-8", md: "size-9", lg: "size-10" }[size];
  // 동그라미 폭의 60%쯤, 윗부분에 살짝 걸치게(머리에 쓴 것처럼)
  const crownCls = { sm: "size-5 -top-3", md: "size-[22px] -top-3.5", lg: "size-6 -top-4" }[size];
  return (
    <span className="relative inline-flex shrink-0">
      {p.avatarUrl ? (
        // 구글 프로필 사진. 리퍼러를 보내면 가끔 막혀서 보내지 않는다
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatarUrl} alt="" referrerPolicy="no-referrer" className={`${circle} rounded-full border-2 ${crown ? "border-mango" : "border-line"} object-cover`} />
      ) : (
        <span aria-hidden className={`${circle} flex items-center justify-center rounded-full bg-mango text-[15px] font-black text-ink ${crown ? "ring-2 ring-mango-deep/40" : ""}`}>
          {initial}
        </span>
      )}
      {crown && <Crown className={`absolute left-1/2 -translate-x-1/2 -rotate-[10deg] drop-shadow-[0_1px_0_rgb(255_255_255)] ${crownCls}`} />}
    </span>
  );
}

/**
 * 계정 메뉴: 프로필 사진(+이름)을 누르면 계정 정보와 로그아웃이 열린다.
 * 데스크톱은 왼쪽 메뉴 맨 아래(위로 열림), 모바일은 위쪽 막대 오른쪽(아래로 열림).
 */
export function AccountMenu({ placement }: { placement: "up" | "down" }) {
  const p = useProfile();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const name = p.displayName ?? (p.demo ? "데모 계정" : "맹고 사용자");
  const premium = p.plan === "plus";
  const account = p.demo ? "공용 데모 계정(로컬 개발용)" : `${p.provider === "apple" ? "Apple" : "Google"} 계정${p.email ? ` · ${p.email}` : ""}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`계정 메뉴, ${name}${premium ? ", Premium" : ""}`}
        onClick={() => setOpen((o) => !o)}
        className={
          placement === "up"
            ? "flex w-full min-h-[52px] items-center gap-3 rounded-xl px-2 text-left hover:bg-snow"
            : "flex size-11 items-center justify-center rounded-full hover:bg-snow"
        }
      >
        <Avatar size={placement === "up" ? "md" : "sm"} crown={premium} />
        {placement === "up" && (
          <>
            <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{name}</span>
            <IconChevronDown className={`size-5 shrink-0 text-faint transition-transform ${open ? "" : "rotate-180"}`} />
          </>
        )}
      </button>
      {open && (
        <div
          id="account-menu"
          className={`tile absolute z-50 w-64 p-2 shadow-[0_12px_32px_rgb(31_35_64/0.18)] ${
            placement === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"
          }`}
        >
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar size="lg" crown={premium} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-black">{name}</p>
              <p className="truncate text-[12px] font-semibold text-sub">{account}</p>
            </div>
          </div>
          {premium ? (
            <p className="mx-2 mb-2 inline-flex items-center gap-1 rounded-lg bg-mango-tint px-2 py-0.5 text-[12px] font-extrabold text-mango-deep">
              <Crown className="size-3.5" />
              Premium
              {p.premiumDaysLeft !== null ? ` · ${p.premiumDaysLeft}일 남음` : BETA ? " · 베타 무료" : ""}
            </p>
          ) : (
            <div className="mx-2 mb-2 flex items-center justify-between gap-2">
              <span className="rounded-lg bg-snow px-2 py-0.5 text-[12px] font-extrabold text-sub">Free</span>
              <Link href="/settings#plan" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-[13px] font-extrabold text-mango-deep no-underline hover:underline">
                <Crown className="size-3.5" />
                Premium 알아보기
              </Link>
            </div>
          )}
          <form action={signOut} className="border-t-2 border-line pt-2">
            <button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-[15px] font-extrabold text-orange hover:bg-snow">
              로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
