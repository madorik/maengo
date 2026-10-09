"use client";

import { createContext, useContext } from "react";
import type { ProfileView } from "@/lib/types";

const ProfileContext = createContext<ProfileView | null>(null);

export function ProfileProvider({ profile, children }: { profile: ProfileView; children: React.ReactNode }) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileView {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile은 ProfileProvider 안에서만 쓸 수 있어요");
  return ctx;
}
