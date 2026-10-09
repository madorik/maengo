"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { SIGNED_IN_HINT } from "@/lib/session-cookie";

// 소개 페이지는 검색과 속도를 위해 정적으로 만든다. 로그인했는지는 브라우저에서 힌트 쿠키로만 보고 버튼만 바꾼다.
// 서버에서는 늘 로그인 전 모습으로 그리고, 화면에 붙은 뒤 로그인했으면 바뀐다.

const subscribe = () => () => {};
const isSignedIn = () => document.cookie.split("; ").some((c) => c === `${SIGNED_IN_HINT}=1`);

export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribe, isSignedIn, () => false);
}

type Target = { href: string; label: string };

/** 로그인 전/후에 다른 곳으로 가는 버튼. signedIn이 null이면 로그인한 사람에게는 숨긴다 */
export function AuthLink({ signedOut, signedIn, className }: { signedOut: Target; signedIn: Target | null; className: string }) {
  const on = useSignedIn();
  const target = on ? signedIn : signedOut;
  if (!target) return null;
  return (
    <Link href={target.href} className={className}>
      {target.label}
    </Link>
  );
}
