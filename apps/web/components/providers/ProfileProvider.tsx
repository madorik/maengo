"use client";

import * as Sentry from "@sentry/nextjs";
import { createContext, useContext, useEffect } from "react";
import type { ProfileView } from "@/lib/types";

const ProfileContext = createContext<ProfileView | null>(null);

export function ProfileProvider({ profile, children }: { profile: ProfileView; children: React.ReactNode }) {
  // 브라우저·앱 화면 오류(Sentry)에 회원 id만 남긴다(이메일·이름은 보내지 않는다)
  useEffect(() => {
    Sentry.setUser({ id: profile.id });
    return () => Sentry.setUser(null);
  }, [profile.id]);
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileView {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile은 ProfileProvider 안에서만 쓸 수 있어요");
  return ctx;
}

/** 화면에서 부르는 이름: 프로필 이름(구글·애플이 준 이름). 없으면 null — 이름 없이 쓴다('회원님'으로 부르지 않는다, 2026-11-11 사용자) */
export function useCallName(): string | null {
  return useProfile().displayName?.trim() || null;
}
