"use server";

import type { Persona, Plan, Voice } from "@maengo/core/types";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "@/lib/session-cookie";
import { must, db } from "@/lib/server/db";
import { rebuildFeed } from "@/lib/server/feed";
import { demoLoginEnabled, demoToolsEnabled, isDemoAccount } from "@/lib/server/demo";
import { entitlements } from "@/lib/server/profile";
import { currentProfile, demoUserId, requireProfile } from "@/lib/server/session";
import { addCustomTopics, addTopics, removeTopic } from "@/lib/server/topics";
import { signSession } from "@/lib/session-token";
import { supabaseAuth } from "@/lib/supabase/server";
import { isNotifyTime, notifyTimeLabel } from "@maengo/core/kst";
import { josa } from "@maengo/core/josa";
import { isAdultInterest, TOPIC_BY_ID } from "@maengo/core/topics";
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

/**
 * 처음 고른 관심 분야를 저장하고 오늘 피드로 간다(PLAN.md 5.2).
 * 기타를 고르고 적은 말은 설정 > 관심사의 기타와 같은 규칙으로 넣는다(목록에 있는 말은 관심사로). 기타만 골라도 된다.
 */
export async function completeOnboarding(formData: FormData) {
  const profile = await requireProfile();
  const limit = entitlements(profile).topicLimit;
  const picked = [...new Set(formData.getAll("topic").map(String))].filter((id) => TOPIC_BY_ID.has(id)).slice(0, limit);
  const etc = formData.get("etc") === "on";
  const etcText = etc ? String(formData.get("etcText") ?? "").trim() : "";
  if (etc && !etcText) redirect("/onboarding?error=etc");
  if (isAdultInterest(etcText)) redirect("/onboarding?error=adult");
  if (!picked.length && !etcText) redirect("/onboarding?error=empty");
  if (picked.length) {
    must(
      await db.from("user_topics").upsert(
        picked.map((topic_id) => ({ user_id: profile.id, topic_id, weight: 1, source: "onboarding" })),
        { onConflict: "user_id,topic_id" },
      ),
      "user_topics onboarding",
    );
  }
  // 분야는 이미 넣었으니 기타가 막히면 다시 제출할 때 같은 분야를 덮어쓴다
  if (etcText) {
    const r = await addCustomTopics(profile, etcText);
    if (r.tone === "warn") redirect(`/onboarding?error=${r.code === "adult" ? "adult" : "etc"}`);
  }
  must(await db.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", profile.id), "profiles onboarded");
  redirect("/today");
}

/**
 * 계정 삭제(설정 > 계정). auth 사용자를 지우면 프로필·관심사·피드·읽음·피드백·기기 토큰이 함께 지워진다(on delete cascade).
 * 아무도 안 쓰게 된 기타 관심사 문구도 지운다(이미 소식 분류에 쓰였으면 FK 때문에 남는다). 데모 계정은 지우지 않는다.
 */
export async function deleteAccount() {
  const profile = await requireProfile();
  if (isDemoAccount(profile.id)) redirect("/settings#account");
  const custom = (must(await db.from("user_topics").select("topic_id").eq("user_id", profile.id).like("topic_id", "c-%"), "user_topics custom") as { topic_id: string }[]).map((r) => r.topic_id);
  const { error } = await db.auth.admin.deleteUser(profile.id);
  if (error) throw new Error(`계정 삭제: ${error.message}`);
  for (const id of custom) {
    const { count } = await db.from("user_topics").select("user_id", { count: "exact", head: true }).eq("topic_id", id);
    if (!count) await db.from("topics").delete().eq("id", id);
  }
  const jar = await cookies();
  for (const c of jar.getAll()) if (c.name.startsWith("sb-")) jar.delete(c.name);
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_HINT);
  redirect("/login?deleted=1");
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
  if (value === profile.notifyAt) {
    const label = notifyTimeLabel(value);
    return { notifyAt: value, tone: "ok", message: profile.pushEnabled ? `이미 ${label}에 알려 드리고 있어요.` : `이미 ${josa(label, "으로", "로")} 골라 두었어요.` };
  }
  must(await db.from("profiles").update({ notify_at: value }).eq("id", profile.id), "profiles notify_at");
  revalidatePath("/", "layout");
  return { notifyAt: value, tone: "ok", message: `알림 시간을 ${josa(notifyTimeLabel(value), "으로", "로")} 바꿨어요.` };
}

export interface PushResult {
  enabled: boolean;
  tone: "ok" | "warn";
  message: string;
}

/**
 * 설정 > 알림 켜고 끄기. 켤 때는 먼저 이 기기를 /api/devices로 등록해 둔다(등록된 기기가 없으면 켜지 않는다).
 * 끄면 그 사람의 기기 토큰을 모두 지워 어느 기기에도 보내지 않는다. 맹고는 알림 시각에 계속 만들어 둔다.
 */
export async function setPushEnabled(enabled: boolean): Promise<PushResult> {
  const profile = await requireProfile();
  const on = enabled === true;
  const label = notifyTimeLabel(profile.notifyAt);
  if (on) {
    const { count } = await db.from("device_tokens").select("token", { count: "exact", head: true }).eq("user_id", profile.id);
    if (!count) return { enabled: false, tone: "warn", message: "알림 받을 기기를 등록하지 못했어요. 다시 켜 주세요." };
  }
  must(await db.from("profiles").update({ push_enabled: on }).eq("id", profile.id), "profiles push_enabled");
  if (!on) must(await db.from("device_tokens").delete().eq("user_id", profile.id), "device_tokens");
  revalidatePath("/", "layout");
  return on
    ? { enabled: true, tone: "ok", message: `알림을 켰어요. 매일 ${label}에 알려 드려요.` }
    : { enabled: false, tone: "ok", message: `알림을 껐어요. 맹고는 매일 ${label}에 준비해 둘게요.` };
}

const VOICES: Voice[] = ["f", "m"];

export async function savePlayerPrefs(prefs: { persona?: Persona; voice?: Voice; autoNext?: boolean; skipRead?: boolean }) {
  const profile = await currentProfile();
  if (!profile) return;
  const patch: Record<string, unknown> = {};
  // 말투는 아나운서 하나로 고정이라 받지 않는다(core/audio의 PERSONA)
  if (prefs.voice && VOICES.includes(prefs.voice)) patch.voice = prefs.voice;
  if (typeof prefs.autoNext === "boolean") patch.auto_next = prefs.autoNext;
  if (typeof prefs.skipRead === "boolean") patch.skip_read = prefs.skipRead;
  if (Object.keys(patch).length) must(await db.from("profiles").update(patch).eq("id", profile.id), "profiles prefs");
}

/**
 * 관심사 고치기(설정). 폼 하나에서 셋 중 하나가 온다.
 * text: 기타에 적기 / add: 목록에서 관심사 더하기 / remove: 관심사 빼기(기타 포함)
 */
export async function editTopics(_prev: TopicResult | null, formData: FormData): Promise<TopicResult | null> {
  const profile = await requireProfile();
  let result: TopicResult | null = null;
  const text = formData.get("text");
  const add = formData.get("add");
  const remove = formData.get("remove");
  if (typeof text === "string") result = await addCustomTopics(profile, text);
  else if (typeof add === "string") result = await addTopics(profile, [add]);
  else if (typeof remove === "string") result = await removeTopic(profile, remove);
  revalidatePath("/settings");
  return result;
}

// ---- 데모 도구(설정 화면). 결제가 붙으면 지운다. ----

export async function demoSetPlan(formData: FormData) {
  const plan = formData.get("plan") as Plan;
  if (!demoToolsEnabled() || !["free", "plus"].includes(plan)) return;
  const profile = await requireProfile();
  // 데모 전환의 Premium은 결제한 것처럼 기한 없이 둔다
  must(await db.from("profiles").update({ plan, premium_until: null }).eq("id", profile.id), "profiles plan");
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
