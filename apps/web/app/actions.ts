"use server";

import { ONBOARDING_TOPIC_LIMIT } from "@maengo/core/plans";
import type { Voice } from "@maengo/core/types";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { withBase } from "@/lib/base-path";
import { isRate } from "@/lib/player/rate";
import { allowedOrigin, googleAuthUrl, googleDirectEnabled, LOGIN_TTL_SEC, randomToken, signState, STATE_COOKIE } from "@/lib/server/google-login";
import { SESSION_COOKIE, SIGNED_IN_HINT } from "@/lib/session-cookie";
import { must, db } from "@/lib/server/db";
import { addToPlaylist, clearPlaylist, isInPlaylist, rebuildFeed, receiveMore, removeFromPlaylist, reorderPlaylist, type MoreResult } from "@/lib/server/feed";
import { demoLoginEnabled, demoToolsEnabled, isDemoAccount } from "@/lib/server/demo";
import { entitlements } from "@/lib/server/profile";
import { currentProfile, demoUserId, requireProfile } from "@/lib/server/session";
import { addLink, releaseLinks, removeLink } from "@/lib/server/links";
import { addCustomTopics, addTopics, removeTopic, setGroupPicks } from "@/lib/server/topics";
import { signSession } from "@/lib/session-token";
import { supabaseAuth } from "@/lib/supabase/server";
import { isNotifyTime } from "@maengo/core/kst";
import { isAdultInterest, TOPIC_BY_ID } from "@maengo/core/topics";
import type { TopicResult } from "@/lib/types";

const cookieOpts = { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 } as const;

/**
 * 지금 요청의 주소(구글 로그인 뒤 돌아올 곳). 브라우저가 보낸 Origin을 먼저 쓴다:
 * watalabs.com이 맹고를 프록시하면 호스트 헤더는 maengo.vercel.app이라, 그걸 쓰면 로그인 뒤 다른 도메인으로 간다.
 */
async function origin(): Promise<string> {
  const h = await headers();
  const sent = h.get("origin");
  if (sent && sent !== "null") return sent;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * 구글·애플: Supabase OAuth로 각 로그인 화면에 보낸다. 돌아오면 /auth/callback이 세션을 만든다.
 * 구글은 GOOGLE_DIRECT_LOGIN=1이면 우리 도메인으로 받는다(구글 화면에 supabase 주소가 안 보이게, lib/server/google-login.ts).
 * 데모(로컬 개발만): OAuth 없이 공용 데모 계정(DEMO_USER_ID)으로 들어간다(서명한 세션 쿠키).
 */
export async function signIn(formData: FormData) {
  const jar = await cookies();
  const provider = formData.get("provider");
  // 구글 콘솔에 등록한 도메인에서 들어왔을 때만. 아니면 아래 Supabase OAuth로
  const from = provider === "google" && googleDirectEnabled() ? allowedOrigin(await origin()) : null;
  if (from) {
    const r = randomToken();
    jar.set(STATE_COOKIE, r, { ...cookieOpts, httpOnly: true, maxAge: LOGIN_TTL_SEC });
    redirect(googleAuthUrl(from, signState({ f: "web", r, o: from })));
  }
  if (provider === "google" || provider === "apple") {
    const supabase = await supabaseAuth();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${await origin()}${withBase("/auth/callback")}`,
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
 * 플랜 한도(topicLimit)보다 많이 고르면 몰래 자르지 않고 되돌려 보낸다(화면은 한도가 차면 더 못 고르게 막는다)
 */
export async function completeOnboarding(formData: FormData) {
  const profile = await requireProfile();
  const limit = Math.min(ONBOARDING_TOPIC_LIMIT, entitlements(profile).topicLimit);
  const picked = [...new Set(formData.getAll("topic").map(String))].filter((id) => TOPIC_BY_ID.has(id));
  if (picked.length > limit) redirect("/onboarding?error=limit");
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
  // '시작하기'를 누를 때 알림 권한을 받아 이 기기를 등록했으면(OnboardingSubmit) 알림을 켠 채로 시작한다(2026-10-23 사용자 결정).
  // 설정의 알림 켜기와 같이 등록된 기기가 있을 때만 켠다. 시간은 기본값(오전 7시), 설정에서 바꾼다
  let pushEnabled = false;
  if (formData.get("push") === "on") {
    const { count } = await db.from("device_tokens").select("token", { count: "exact", head: true }).eq("user_id", profile.id);
    pushEnabled = !!count;
  }
  must(
    await db
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString(), ...(pushEnabled ? { push_enabled: true } : {}) })
      .eq("id", profile.id),
    "profiles onboarded",
  );
  redirect("/today");
}

/**
 * 계정 삭제(설정 > 계정). auth 사용자를 지우면 프로필·관심사·피드·읽음·피드백·기기 토큰이 함께 지워진다(on delete cascade).
 * 아무도 안 쓰게 된 기타 관심사 문구도 지우고(이미 소식 분류에 쓰였으면 FK 때문에 남는다), 아무도 구독하지 않게 된 내 관심 링크 출처는 끈다. 데모 계정은 지우지 않는다.
 */
export async function deleteAccount() {
  const profile = await requireProfile();
  if (isDemoAccount(profile.id)) redirect("/settings#account");
  const mine = (must(await db.from("user_topics").select("topic_id").eq("user_id", profile.id).or("topic_id.like.c-*,topic_id.like.s-*"), "user_topics custom") as { topic_id: string }[]).map((r) => r.topic_id);
  const custom = mine.filter((id) => id.startsWith("c-"));
  const links = mine.filter((id) => id.startsWith("s-"));
  const { error } = await db.auth.admin.deleteUser(profile.id);
  if (error) throw new Error(`계정 삭제: ${error.message}`);
  for (const id of custom) {
    const { count } = await db.from("user_topics").select("user_id", { count: "exact", head: true }).eq("topic_id", id);
    if (!count) await db.from("topics").delete().eq("id", id);
  }
  await releaseLinks(links);
  const jar = await cookies();
  for (const c of jar.getAll()) if (c.name.startsWith("sb-")) jar.delete(c.name);
  jar.delete(SESSION_COOKIE);
  jar.delete(SIGNED_IN_HINT);
  redirect("/login?deleted=1");
}

export interface NotifyResult {
  notifyAt: string;
  /** 저장하지 못했을 때만(성공은 고른 버튼으로 보인다) */
  error?: string;
}

/** 설정 > 알림 시간. 하루 아무 때나 1분 단위('HH:MM') */
export async function saveNotifyAt(_prev: NotifyResult | null, formData: FormData): Promise<NotifyResult> {
  const profile = await requireProfile();
  const value = formData.get("notifyAt");
  if (!isNotifyTime(value)) return { notifyAt: profile.notifyAt, error: "고를 수 없는 시간이에요." };
  if (value !== profile.notifyAt) {
    must(await db.from("profiles").update({ notify_at: value }).eq("id", profile.id), "profiles notify_at");
    revalidatePath("/", "layout");
  }
  return { notifyAt: value };
}

export interface PushResult {
  enabled: boolean;
  /** 켜지 못했을 때만 */
  error?: string;
}

/**
 * 설정 > 알림 켜고 끄기. 켤 때는 먼저 이 기기를 /api/devices로 등록해 둔다(등록된 기기가 없으면 켜지 않는다).
 * 끄면 그 사람의 기기 토큰을 모두 지워 어느 기기에도 보내지 않는다. 맹고는 알림 시각에 계속 만들어 둔다.
 */
export async function setPushEnabled(enabled: boolean): Promise<PushResult> {
  const profile = await requireProfile();
  const on = enabled === true;
  if (on) {
    const { count } = await db.from("device_tokens").select("token", { count: "exact", head: true }).eq("user_id", profile.id);
    if (!count) return { enabled: false, error: "알림 받을 기기를 등록하지 못했어요. 다시 켜 주세요." };
  }
  must(await db.from("profiles").update({ push_enabled: on }).eq("id", profile.id), "profiles push_enabled");
  if (!on) must(await db.from("device_tokens").delete().eq("user_id", profile.id), "device_tokens");
  revalidatePath("/", "layout");
  return { enabled: on };
}

/** 오늘 맹고 하나 더 받기(하루 맹고를 넘으면 지갑에서 1맹고). 붙으면 오늘 화면을 새로 그린다 */
export async function receiveMoreAction(): Promise<MoreResult> {
  const profile = await requireProfile();
  const res = await receiveMore(profile);
  if (res.ok) revalidatePath("/today");
  return res;
}

// ---- 플레이리스트(Premium). 담기는 보관함 '골라 듣기', 고치기는 /playlist ----

/** 담기. 끝나면 플레이리스트 화면으로 간다(담은 결과가 거기 보인다) */
export async function playlistAdd(ids: number[]) {
  const profile = await requireProfile();
  if (!entitlements(profile).audio) redirect("/premium");
  await addToPlaylist(profile, ids.filter((n) => Number.isInteger(n) && n > 0));
  revalidatePath("/playlist");
  redirect("/playlist");
}

/** 글 화면의 담기 버튼: 담거나 뺀다 */
export async function playlistToggle(clusterId: number, on: boolean): Promise<{ inPlaylist: boolean; error?: string }> {
  const profile = await requireProfile();
  if (!entitlements(profile).audio) return { inPlaylist: false };
  if (on) await addToPlaylist(profile, [clusterId]);
  else await removeFromPlaylist(profile, clusterId);
  revalidatePath("/playlist");
  const inPlaylist = await isInPlaylist(profile, clusterId);
  return on && !inPlaylist ? { inPlaylist, error: "담지 못했어요. 다시 눌러 주세요." } : { inPlaylist };
}

export async function playlistRemove(clusterId: number) {
  const profile = await requireProfile();
  await removeFromPlaylist(profile, clusterId);
  revalidatePath("/playlist");
}

/** 끌어서 바꾼 순서 저장 */
export async function playlistReorder(ids: number[]) {
  const profile = await requireProfile();
  await reorderPlaylist(profile, ids.filter((n) => Number.isInteger(n) && n > 0));
  revalidatePath("/playlist");
}

export async function playlistClear() {
  const profile = await requireProfile();
  await clearPlaylist(profile);
  revalidatePath("/playlist");
}

/**
 * 되돌리기(빼기·비우기 바로 뒤의 알림): back을 다시 담고 order(뺄 때 보이던 순서)대로 맞춘다.
 * 이미 담긴 건 다시 담지 않아 겹치지 않고, order에 없는 것(그사이 다른 곳에서 담은 것)은 뒤에 둔다
 */
export async function playlistRestore(back: number[], order: number[]) {
  const profile = await requireProfile();
  if (!entitlements(profile).audio) return;
  const valid = (ids: unknown) => (Array.isArray(ids) ? ids.filter((n): n is number => Number.isInteger(n) && n > 0) : []);
  await addToPlaylist(profile, valid(back));
  await reorderPlaylist(profile, valid(order));
  revalidatePath("/playlist");
}

const VOICES: Voice[] = ["f", "m"];

export async function savePlayerPrefs(prefs: { voice?: Voice; autoNext?: boolean; skipRead?: boolean; rate?: number }) {
  const profile = await currentProfile();
  if (!profile) return;
  const patch: Record<string, unknown> = {};
  if (prefs.voice && VOICES.includes(prefs.voice)) patch.voice = prefs.voice;
  if (typeof prefs.autoNext === "boolean") patch.auto_next = prefs.autoNext;
  if (typeof prefs.skipRead === "boolean") patch.skip_read = prefs.skipRead;
  if (isRate(prefs.rate)) patch.playback_rate = prefs.rate;
  if (Object.keys(patch).length) must(await db.from("profiles").update(patch).eq("id", profile.id), "profiles prefs");
}

/**
 * 관심사 고치기(설정). 넷 중 하나가 온다.
 * group+pick: 분야 하나에서 고른 것 통째로 정하기 / add: 관심사 켜기(뉴스 분야) / remove: 관심사 끄기(기타 포함) /
 * text: 적은 말 넣기(사전에 있으면 그 관심사, 없으면 기타)
 */
export async function editTopics(_prev: TopicResult | null, formData: FormData): Promise<TopicResult | null> {
  const profile = await requireProfile();
  let result: TopicResult | null = null;
  const text = formData.get("text");
  const add = formData.get("add");
  const remove = formData.get("remove");
  const group = formData.get("group");
  if (typeof group === "string") result = await setGroupPicks(profile, group, String(formData.get("pick") ?? ""));
  else if (typeof add === "string") result = await addTopics(profile, [add]);
  else if (typeof remove === "string") result = await removeTopic(profile, remove);
  else if (typeof text === "string") result = await addCustomTopics(profile, text);
  revalidatePath("/settings");
  return result;
}

/** 설정 > 내 관심 링크 칸: 빼기(removeLink, ✕ 버튼)가 먼저, 아니면 그 칸(slot)에 주소 넣기(link). 결과 모양은 관심사와 같다 */
export async function editLinks(_prev: TopicResult | null, formData: FormData): Promise<TopicResult | null> {
  const profile = await requireProfile();
  let result: TopicResult | null = null;
  const remove = formData.get("removeLink");
  const link = formData.get("link");
  if (typeof remove === "string") result = await removeLink(profile, remove);
  else if (typeof link === "string") result = await addLink(profile, link, Number(formData.get("slot")));
  revalidatePath("/settings");
  return result;
}

// ---- 데모 도구(설정 화면, 로컬 개발만). 플랜 바꾸기는 결제가 붙어 지웠다(2026-10-14) ----

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
