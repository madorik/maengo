"use server";

import type { Persona, Plan, Voice } from "@maengo/core/types";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "@/lib/session-cookie";
import { must, db } from "@/lib/server/db";
import { rebuildFeed } from "@/lib/server/feed";
import { demoLoginEnabled, demoToolsEnabled } from "@/lib/server/demo";
import { entitlements } from "@/lib/server/profile";
import { currentProfile, demoUserId, requireProfile } from "@/lib/server/session";
import { addTopics, addTopicsFromText, removeTopic } from "@/lib/server/topics";
import { signSession } from "@/lib/session-token";
import { supabaseAuth } from "@/lib/supabase/server";
import { isNotifyTime, notifyTimeLabel } from "@maengo/core/kst";
import { josa } from "@maengo/core/josa";
import { TOPIC_BY_ID } from "@maengo/core/topics";
import type { TopicResult } from "@/lib/types";

const cookieOpts = { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 } as const;

/** 지금 요청의 주소(구글 로그인 뒤 돌아올 곳). 배포 뒤에는 프록시 헤더를 따른다 */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * 구글·애플: Supabase OAuth로 각 로그인 화면에 보낸다. 돌아오면 /auth/callback이 세션을 만든다.
 * 데모(로컬 개발만): OAuth 없이 공용 데모 계정(DEMO_USER_ID)으로 들어간다(서명한 세션 쿠키).
 */
export async function signIn(formData: FormData) {
  const jar = await cookies();
  const provider = formData.get("provider");
  if (provider === "google" || provider === "apple") {
    const supabase = await supabaseAuth();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${await origin()}/auth/callback`,
        ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
      },
    });
    if (error || !data.url) redirect(`/login?error=${provider}`);
    redirect(data.url);
  }
  if (!demoLoginEnabled()) redirect("/login");
  jar.set(SESSION_COOKIE, await signSession({ userId: demoUserId(), provider: "apple" }), { ...cookieOpts, httpOnly: true });
  jar.set(SIGNED_IN_HINT, "1", cookieOpts);
  redirect("/today");
}

export async function signOut() {
  const supabase = await supabaseAuth();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_HINT);
  redirect("/login");
}

/** 처음 고른 관심 토픽을 저장하고 오늘 피드로 간다(PLAN.md 5.2) */
export async function completeOnboarding(formData: FormData) {
  const profile = await requireProfile();
  const limit = entitlements(profile).topicLimit;
  const picked = [...new Set(formData.getAll("topic").map(String))].filter((id) => TOPIC_BY_ID.has(id)).slice(0, limit);
  if (!picked.length) redirect("/onboarding?error=empty");
  must(
    await db.from("user_topics").upsert(
      picked.map((topic_id) => ({ user_id: profile.id, topic_id, weight: 1, source: "onboarding" })),
      { onConflict: "user_id,topic_id" },
    ),
    "user_topics onboarding",
  );
  must(await db.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", profile.id), "profiles onboarded");
  redirect("/today");
}

export interface NotifyResult {
  notifyAt: string;
  tone: "ok" | "warn";
  message: string;
}

/** 설정 > 알림 시간. 아침 6시~밤 11시 30분, 30분 단위만 받는다 */
export async function saveNotifyAt(_prev: NotifyResult | null, formData: FormData): Promise<NotifyResult> {
  const profile = await requireProfile();
  const value = formData.get("notifyAt");
  if (!isNotifyTime(value)) return { notifyAt: profile.notifyAt, tone: "warn", message: "고를 수 없는 시간이에요. 목록에서 골라 주세요." };
  if (value === profile.notifyAt) return { notifyAt: value, tone: "ok", message: `이미 ${notifyTimeLabel(value)}에 알려 드리고 있어요.` };
  must(await db.from("profiles").update({ notify_at: value }).eq("id", profile.id), "profiles notify_at");
  revalidatePath("/", "layout");
  return { notifyAt: value, tone: "ok", message: `알림 시간을 ${josa(notifyTimeLabel(value), "으로", "로")} 바꿨어요.` };
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
  if (!demoToolsEnabled() || !["free", "trial", "plus"].includes(plan)) return;
  const profile = await requireProfile();
  const trialEndsAt = plan === "trial" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
  must(await db.from("profiles").update({ plan, trial_ends_at: trialEndsAt }).eq("id", profile.id), "profiles plan");
  revalidatePath("/", "layout");
}

/** 오늘 피드를 이미 요약된 소식으로 다시 고른다(LLM 호출 없음) */
export async function demoRebuildFeed() {
  if (!demoToolsEnabled()) return;
  const profile = await requireProfile();
  await rebuildFeed(profile);
  revalidatePath("/", "layout");
}

/** 읽음·피드백을 지우고 토픽 가중치를 1로 되돌린 뒤 오늘 피드를 다시 고른다 */
export async function demoReset() {
  if (!demoToolsEnabled()) return;
  const profile = await requireProfile();
  must(await db.from("feedback").delete().eq("user_id", profile.id), "feedback reset");
  must(await db.from("reads").delete().eq("user_id", profile.id), "reads reset");
  must(await db.from("user_topics").update({ weight: 1 }).eq("user_id", profile.id), "weights reset");
  await rebuildFeed(profile);
  revalidatePath("/", "layout");
}
