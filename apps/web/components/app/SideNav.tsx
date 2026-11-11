"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { AppQr } from "@/components/app-install/AppQr";
import { IconClose } from "@/components/icons";
import { MangoIcon } from "@/components/MangoIcon";
import { useProfile } from "@/components/providers/ProfileProvider";
import { isAppUserAgent } from "@/lib/app-client";
import { hiddenRecently, hideFor7Days } from "@/lib/app-install";
import { AccountMenu } from "./AccountMenu";
import { NavLinks } from "./NavLinks";

/** 데스크톱 왼쪽 메뉴(모바일은 위쪽 막대의 ☰로 여는 MobileNav) */
export function SideNav() {
  return (
    <div className="sticky top-0 hidden h-dvh flex-col border-r-2 border-line px-4 py-7 lg:flex">
      <Link href="/" aria-label="맹고 소개" className="flex items-center gap-2 px-3 no-underline">
        <MangoIcon className="size-9" />
        <span className="text-[28px] font-black tracking-[-0.04em] text-mango-deep">맹고</span>
      </Link>
      <div className="mt-8">
        <NavLinks />
      </div>
      {/* 왼쪽 아래: 앱 받기 QR(앱 안 쓰는 회원만), 그 아래 계정(프로필 사진·이름 → 로그아웃, Premium이면 사진에 왕관) */}
      <div className="mt-auto">
        <AppQrCard />
        <div className="border-t-2 border-line pt-3">
          <AccountMenu placement="up" />
        </div>
      </div>
    </div>
  );
}

const QR_KEY = "maengo_side_qr_closed";
const noSubscribe = () => () => {};

/**
 * PC 웹 왼쪽 메뉴의 '휴대폰으로 받기' QR(2026-11-11, lib/app-install.ts). 앱을 연 적 없는 회원에게만, 닫으면 7일 동안 안 보인다.
 * 큰 화면의 앱(아이패드 등)에는 안 보인다. 계정 바로 위
 */
function AppQrCard() {
  const { usesApp } = useProfile();
  const can = useSyncExternalStore(noSubscribe, () => !isAppUserAgent(navigator.userAgent) && !hiddenRecently(QR_KEY), () => false);
  const [closed, setClosed] = useState(false);
  if (usesApp || !can || closed) return null;
  return (
    <div className="relative mb-4 flex items-center gap-3 rounded-2xl border border-line p-3">
      <AppQr spot="side" size={68} />
      <p className="min-w-0 pr-4 text-[13px] font-semibold leading-snug">
        출퇴근길엔 휴대폰으로
        <span className="mt-0.5 block font-medium text-sub">찍어서 앱 받기</span>
      </p>
      <button
        type="button"
        aria-label="앱 받기 QR 닫기"
        onClick={() => {
          hideFor7Days(QR_KEY);
          setClosed(true);
        }}
        className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full text-faint hover:text-sub"
      >
        <IconClose className="size-3.5" />
      </button>
    </div>
  );
}
