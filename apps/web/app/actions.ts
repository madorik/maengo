"use server";

import type { Persona, Plan, Voice } from "@maengo/core/types";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "@/lib/session-cookie";
import { rebuildFeed } from "@/lib/server/feed";
import { currentProfile, requireProfile, sessionValue } from "@/lib/server/session";
import { createDemoProfile, resetUser, store } from "@/lib/server/store";
import { addTopics, addTopicsFromText, removeTopic } from "@/lib/server/topics";
import type { TopicResult } from "@/lib/types";

/** 데모 로그인: 애플·구글 버튼을 누르면 OAuth 없이 바로 들어간다. Supabase Auth가 붙으면 signInWithOAuth로 바뀐다. */
export async function signIn(formData: FormData) {
  const provider = formData.get("provider") === "apple" ? "apple" : "google";
  const jar = await cookies();
  const opts = { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 } as const;
  jar.set(SESSION_COOKIE, sessionValue(provider), { ...opts, httpOnly: true });
  jar.set(SIGNED_IN_HINT, "1", opts);
  if (!store.profiles.has("demo")) createDemoProfile("demo", provider);
  else store.profiles.get("demo")!.provider = provider;
  redirect("/today");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_HINT);
  redirect("/login");
}

const PERSONAS: Persona[] = ["announcer", "teacher", "dialogue"];
const VOICES: Voice[] = ["f", "m"];

export async function savePlayerPrefs(prefs: { persona?: Persona; voice?: Voice; autoNext?: boolean; skipRead?: boolean }) {
  const profile = await currentProfile();
  if (!profile) return;
  if (prefs.persona && PERSONAS.includes(prefs.persona)) profile.persona = prefs.persona;
  if (prefs.voice && VOICES.includes(prefs.voice)) profile.voice = prefs.voice;
  if (typeof prefs.autoNext === "boolean") profile.autoNext = prefs.autoNext;
  if (typeof prefs.skipRead === "boolean") profile.skipRead = prefs.skipRead;
}

/**
 * 관심 토픽 고치기(설정). 폼 하나에서 셋 중 하나가 온다.
 * text: 문장으로 추가 / add: 추천 토픽 추가 / remove: 토픽 빼기
 */
export async function editTopics(_prev: TopicResult | null, formData: FormData): Promise<TopicResult | null> {
  const profile = await requireProfile();
  let result: TopicResult | null = null;
  const text = formData.get("text");
  const add = formData.get("add");
  const remove = formData.get("remove");
  if (typeof text === "string") result = await addTopicsFromText(profile, text);
  else if (typeof add === "string") result = addTopics(profile, [add]);
  else if (typeof remove === "string") result = removeTopic(profile, remove);
  revalidatePath("/settings");
  return result;
}

// ---- 데모 도구(설정 화면). 결제와 파이프라인이 붙으면 지운다. ----

export async function demoSetPlan(formData: FormData) {
  const plan = formData.get("plan") as Plan;
  if (!["free", "trial", "plus"].includes(plan)) return;
  const profile = await requireProfile();
  profile.plan = plan;
  profile.trialEndsAt = plan === "trial" ? Date.now() + 7 * 24 * 60 * 60 * 1000 : null;
  revalidatePath("/", "layout");
}

export async function demoRebuildFeed() {
  const profile = await requireProfile();
  rebuildFeed(profile);
  revalidatePath("/", "layout");
}

export async function demoReset() {
  const profile = await requireProfile();
  resetUser(profile.id);
  revalidatePath("/", "layout");
}
