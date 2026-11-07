import type { Metadata } from "next";
import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { GuestTour, type TourPerk } from "@/components/try/GuestTour";
import { ASK_DAILY } from "@/lib/ask";
import { guestTour } from "@/lib/server/guest-tour";
import { getPlans } from "@/lib/server/plans";
import type { GuestItem } from "@/lib/types";

export const metadata: Metadata = {
  title: "둘러보기",
  description: "로그인 없이 맹고가 고른 소식을 음성으로 들어 보세요.",
  // 공유 페이지(/s)처럼 검색에는 내지 않는다(같은 소식이 공개 분야 페이지에 있다)
  robots: { index: false, follow: true },
};

// 로그인 없이 둘러보기(2026-11-07 사용자 결정, 맹고-문서/둘러보기.md). 입구: 로그인 화면, 소개 페이지 첫 화면.
// 고정해 둔 소식(lib/try-items.ts)이라 늘 같은 화면이다. 하루에 한 번만 새로 그린다(요약 문구가 고쳐졌을 때만 달라진다)
export const revalidate = 86400;

/** 스토어 첫 구독 무료 체험 일수(결정 D3, lib/native/billing.ts). 실제 일수는 앱이 스토어에서 받아 체험 안내 팝업에 쓴다 */
const TRIAL_DAYS = 7;

export default async function TryPage() {
  let items: GuestItem[] = [];
  try {
    items = await guestTour();
  } catch (e) {
    // 못 읽으면 빈 화면으로 두고 다음 새로 만들 때 다시 해 본다
    console.error("[try] 둘러볼 소식을 못 읽음", String((e as Error)?.message ?? e).slice(0, 200));
  }
  if (!items.length) return <Empty />;

  const plans = await getPlans();
  const free = plans.get("free")!;
  const plus = plans.get("plus")!;
  // 요금제 비교표(app/(app)/premium/page.tsx)와 같은 숫자
  const perks: TourPerk[] = [
    { label: `하루 소식 ${plus.dailyItems}개`, note: `Free ${free.dailyItems}개` },
    { label: "소식 플레이어로 이어 듣기 무제한", note: free.dailyListens > 0 ? `Free 하루 ${free.dailyListens}개` : undefined },
    { label: "더 자연스러운 AI 목소리" },
    { label: `맹고 AI 질문 하루 ${ASK_DAILY.plus}번`, note: `Free ${ASK_DAILY.free}번` },
    ...(plus.linkLimit > 0 ? [{ label: `내 관심 링크 ${plus.linkLimit}곳` }] : []),
  ];
  return <GuestTour items={items} perks={perks} priceLabel={`월 ${plus.priceKrw.toLocaleString("ko-KR")}원`} trialDays={TRIAL_DAYS} />;
}

function Empty() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[400px] flex-col items-center justify-center px-6 text-center">
      <Mascot mood="listen" className="size-24" />
      <h1 className="mt-4 text-[22px] font-black tracking-[-0.03em]">지금은 들려드릴 소식을 고르고 있어요</h1>
      <p className="mt-2 text-[15px] font-semibold leading-relaxed text-sub">가입하면 고른 분야 소식을 바로 받아 볼 수 있어요.</p>
      <Link href="/login" className="btn mt-8 min-h-14 w-full text-[17px] no-underline">
        무료로 시작하기
      </Link>
    </main>
  );
}
