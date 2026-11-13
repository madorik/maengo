import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseYoutubeSections } from "@/lib/youtube-sections";
import { YOUTUBE_COOKIE } from "@/lib/server/youtube-interests";
import { requireProfile } from "@/lib/server/session";
import { OnboardingFlow } from "./OnboardingFlow";

export const metadata: Metadata = { title: "관심사 찾기", robots: { index: false, follow: false } };

/**
 * 처음 로그인한 사람의 관심사 찾기(2026-11-10 사용자: 사람마다 다른 관심사를 키워드로 고르게 하는 건 시대에 안 맞다).
 * 분야 8개에서 하나씩 뽑은 오늘 소식 중 끌리는 것을 누르면, 맹고가 분야 비중을 정해 시작한다(OnboardingFlow → completeOnboarding).
 * 구글로 로그인하며 유튜브 구독으로 분야를 찾았으면 고르기 없이 결과부터. 비중은 듣고 넘기는 행동으로 계속 맞춘다. 예전 분야 고르기 화면(TopicPicks)은 쓰지 않는다
 */
export default async function OnboardingPage() {
  const profile = await requireProfile();
  if (profile.onboarded) redirect("/today");
  // 구글 로그인 때 유튜브 구독으로 분야를 찾았으면(YOUTUBE_INTERESTS=1) 소식 고르기를 건너뛰고 결과부터 보여 준다
  const youtube = parseYoutubeSections((await cookies()).get(YOUTUBE_COOKIE)?.value);
  // 카드 다음 화면의 안내 한 줄에 프로필 이름('OO님의 맞춤 인사이트'). 호칭은 이름으로(2026-11-11)
  return <OnboardingFlow youtube={youtube} name={profile.displayName?.trim() || null} />;
}
