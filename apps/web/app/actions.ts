"use server";

import type { Persona, Plan, Voice } from "@maengo/core/types";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "@/lib/session-cookie";
import { must, db } from "@/lib/server/db";
import { rebuildFeed } from "@/lib/server/feed";
import { currentProfile, demoUserId, requireProfile } from "@/lib/server/session";
import { addTopics, addTopicsFromText, removeTopic } from "@/lib/server/topics";
import { signSession } from "@/lib/session-token";
import type { TopicResult } from "@/lib/types";

/**
 * 데모 로그인: 애플·구글 버튼 모두 OAuth 없이 Supabase 데모 계정(DEMO_USER_ID)으로 들어간다.
 * 세션 쿠키는 서명한 토큰이라 고쳐 쓰면 로그인이 풀린다. 애플·구글 연동이 붙으면 signInWithOAuth로 바뀐다.
 */
export async function signIn(formData: FormData) {
  const provider = formData.get("provider") === "apple" ? "apple" : "google";
  const jar = await cookies();
  const opts = { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 } as const;
  jar.set(SESSION_COOKIE, await signSession({ userId: demoUserId(), provider }), { ...opts, httpOnly: true });
  jar.set(SIGNED_IN_HINT, "1", opts);
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
  const patch: Record<string, unknown> = {};
  if (prefs.persona && PERSONAS.includes(prefs.persona)) patch.persona = prefs.persona;
  if (prefs.voice && VOICES.includes(prefs.voice)) patch.voice = prefs.voice;
  if (typeof prefs.autoNext === "boolean") patch.auto_next = prefs.autoNext;
  if (typeof prefs.skipRead === "boolean") patch.skip_read = prefs.skipRead;
  if (Object.keys(patch).length) must(await db.from("profiles").update(patch).eq("id", profile.id), "profiles prefs");
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
  else if (typeof add === "string") result = await addTopics(profile, [add]);
  else if (typeof remove === "string") result = await removeTopic(profile, remove);
  revalidatePath("/settings");
  return result;
}

// ---- 데모 도구(설정 화면). 결제가 붙으면 지운다. ----

export async function demoSetPlan(formData: FormData) {
  const plan = formData.get("plan") as Plan;
  if (!["free", "trial", "plus"].includes(plan)) return;
  const profile = await requireProfile();
  const trialEndsAt = plan === "trial" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
  must(await db.from("profiles").update({ plan, trial_ends_at: trialEndsAt }).eq("id", profile.id), "profiles plan");
  revalidatePath("/", "layout");
}

/** 오늘 피드를 이미 요약된 소식으로 다시 고른다(LLM 호출 없음) */
export async function demoRebuildFeed() {
  const profile = await requireProfile();
  await rebuildFeed(profile);
  revalidatePath("/", "layout");
}

/** 읽음·피드백을 지우고 토픽 가중치를 1로 되돌린 뒤 오늘 피드를 다시 고른다 */
export async function demoReset() {
  const profile = await requireProfile();
  must(await db.from("feedback").delete().eq("user_id", profile.id), "feedback reset");
  must(await db.from("reads").delete().eq("user_id", profile.id), "reads reset");
  must(await db.from("user_topics").update({ weight: 1 }).eq("user_id", profile.id), "weights reset");
  await rebuildFeed(profile);
  revalidatePath("/", "layout");
}
