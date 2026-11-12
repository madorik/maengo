import { archiveLabel, type PlanLimits } from "@maengo/core/plans";
import type { Metadata } from "next";
import { Crown } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { PremiumBuy, PremiumPrice, RestorePurchases } from "@/components/premium/StoreParts";
import { PurchaseDoneHost } from "@/components/premium/PurchaseDone";
import { BackButton } from "@/components/ui/BackButton";
import { getPlans } from "@/lib/server/plans";
import { PlanSync } from "@/components/app/PlanSync";
import { hadSubscription, subscriptionView } from "@/lib/server/billing";
import { requireProfile } from "@/lib/server/session";
import { ASK_DAILY } from "@/lib/ask";

export const metadata: Metadata = { title: "맹고 Premium" };

// 결제 페이지(유튜브의 'Premium 받기'처럼 설정과 따로). 입구: 계정 메뉴, 잠긴 듣기 버튼, 맹고가 모자랄 때(#maengo).
// 설정 > 플랜에는 내 플랜만 보여 준다. 결제는 앱 안에서만(애플·구글), 웹에서는 앱에서 살 수 있다고만 알린다.

/**
 * Free·Premium 비교(2026-10-22 사용자 지정, 10-26 가입 선물 줄 빼고 Premium 음성은 '무제한',
 * 10-27 '하루 무료 소식' → '하루 소식'·내 관심 링크 줄 추가, 관심사 개수는 넣지 않음, 10-29 목소리 줄 추가: Premium은 Gemini라 더 자연스럽다,
 * 11-03 맹고 AI 질문 줄 추가, 11-10 주간 리포트 줄 추가, 월간은 뺐다).
 * 숫자는 plans 표(하루 소식·음성·링크·추가 구매·보관 기간), 맹고 AI 질문만 코드 상수(lib/ask.ts ASK_DAILY)
 */
function rows(free: PlanLimits, plus: PlanLimits): { label: string; free: string; plus: string }[] {
  const both = (f: (l: PlanLimits) => string) => ({ free: f(free), plus: f(plus) });
  return [
    // 2026-11-10 하루 두 번 브리핑: 출근길·퇴근길 브리핑마다 이만큼
    { label: "브리핑마다 소식(출근길·퇴근길)", ...both((l) => `${l.dailyItems}개`) },
    // 음성이 없는 플랜도 하루 몇 개는 '이 글 듣기'로 들어 본다(2026-10-23, plans.daily_listens)
    { label: "소식 플레이어 + 음성 듣기(TTS)", ...both((l) => (l.audio ? "무제한" : l.dailyListens > 0 ? `하루 ${l.dailyListens}개` : "불가")) },
    // 음성 엔진: 음성 듣기 플랜은 Gemini, 그 밖은 기본 음성(Chirp, lib/server/ai.ts ttsEngineFor)
    { label: "목소리", ...both((l) => (l.audio ? "더 자연스러운 AI 목소리" : l.dailyListens > 0 ? "기본" : "불가")) },
    { label: "맹고 AI 질문", free: `하루 ${ASK_DAILY.free}번`, plus: `하루 ${ASK_DAILY.plus}번` },
    { label: "주간 리포트", free: "불가", plus: "가능" },
    { label: "받은 소식 보관(북마크는 계속)", ...both((l) => archiveLabel(l.archiveDays)) },
  ];
}

// ?trial=1: 가입 선물 팝업의 '무료로 시작해보기'에서 왔다 → 체험 안내 팝업을 바로 띄운다
export default async function PremiumPage({ searchParams }: { searchParams: Promise<{ trial?: string }> }) {
  const [profile, sp] = await Promise.all([requireProfile(), searchParams]);
  const [plans, hadSub, sub] = await Promise.all([getPlans(), hadSubscription(profile.id), subscriptionView(profile.id)]);
  const free = plans.get("free")!;
  const plus = plans.get("plus")!;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-10 border-b-2 border-line bg-paper pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[600px] items-center px-2">
          <BackButton />
        </div>
      </header>

      <main className="mx-auto max-w-[560px] px-5 pb-[calc(48px+env(safe-area-inset-bottom))] pt-6">
        <section aria-labelledby="premium-title" className="relative overflow-hidden rounded-3xl bg-[#1F2340] px-6 pb-6 pt-6 text-white shadow-[0_6px_0_#11142A] dark:ring-2 dark:ring-line">
          {/* 장식 원. 글자 뒤에 깔려 읽기에는 방해하지 않는다 */}
          <span aria-hidden="true" className="absolute -right-12 -top-14 size-48 rounded-full bg-white/[0.06]" />
          <span aria-hidden="true" className="absolute -bottom-20 right-16 size-36 rounded-full bg-white/[0.04]" />
          <div className="relative flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-black tracking-[0.08em] text-mango">
                <Crown className="size-3.5" />
                PREMIUM
              </span>
              <h1 id="premium-title" className="mt-3 text-[28px] font-black leading-tight tracking-[-0.03em]">
                맹고 Premium
              </h1>
              <p className="mt-1 text-[15px] font-semibold leading-snug text-white/75">{plus.dailyItems > free.dailyItems ? `출근길·퇴근길 ${plus.dailyItems}개씩, 귀로도 들어요` : "더 자연스러운 목소리로, 끝까지 귀로 들어요"}</p>
            </div>
            <span className="flex size-[88px] shrink-0 items-center justify-center rounded-full bg-mango">
              <Mascot mood="listen" className="size-[76px]" />
            </span>
          </div>
          {/* 앱은 결제 버튼과 같은 스토어 가격, 웹은 plans 표 가격 */}
          <PremiumPrice uid={profile.id} priceKrw={plus.priceKrw} listPriceKrw={plus.listPriceKrw} />
        </section>

        <table className="mt-6 w-full overflow-hidden rounded-2xl border-2 border-separate border-spacing-0 border-line text-[15px]">
          <thead>
            <tr className="bg-snow text-[13px] font-extrabold text-sub">
              <th scope="col" className="px-4 py-2 text-left font-extrabold">
                <span className="sr-only">항목</span>
              </th>
              <th scope="col" className="w-[76px] py-2 font-extrabold">
                Free
              </th>
              <th scope="col" className="w-[92px] py-2 font-extrabold text-mango-deep">
                Premium
              </th>
            </tr>
          </thead>
          <tbody>
            {rows(free, plus).map((r) => (
              <tr key={r.label}>
                <th scope="row" className="border-t-2 border-line px-4 py-3.5 text-left font-bold">
                  {r.label}
                </th>
                <td className={`border-t-2 border-line py-3.5 text-center font-bold tabular-nums ${r.free === "불가" ? "text-faint" : "text-sub"}`}>{r.free}</td>
                <td className="border-t-2 border-line bg-mango-tint py-3.5 text-center font-black tabular-nums">{r.plus}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div id="premium-buy" className="mt-6 scroll-mt-20">
          <PremiumBuy uid={profile.id} plan={profile.plan} firstSub={!hadSub} sub={sub} autoTrial={sp.trial === "1"} />
          <PlanSync plan={profile.plan} />
          <PurchaseDoneHost />
        </div>

        <RestorePurchases uid={profile.id} />
      </main>
    </div>
  );
}
