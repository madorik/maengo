import { discountPct, type PlanLimits } from "@maengo/core/plans";
import type { Metadata } from "next";
import { Crown } from "@/components/icons";
import { Mascot } from "@/components/Mascot";
import { MaengoShop, PremiumBuy, RestorePurchases } from "@/components/premium/StoreParts";
import { BackButton } from "@/components/ui/BackButton";
import { getPlans } from "@/lib/server/plans";
import { requireProfile } from "@/lib/server/session";
import { syncWallet } from "@/lib/server/wallet";

export const metadata: Metadata = { title: "맹고 Premium" };

// 결제 페이지(유튜브의 'Premium 받기'처럼 설정과 따로). 입구: 계정 메뉴, 잠긴 듣기 버튼, 맹고가 모자랄 때(#maengo).
// 설정 > 플랜에는 내 플랜만 보여 준다. 결제는 앱 안에서만(애플·구글), 웹에서는 앱에서 살 수 있다고만 알린다.

/** Free·Premium 비교(2026-10-14 사용자 지정: 이 네 줄만). 값은 plans 표 */
function rows(free: PlanLimits, plus: PlanLimits): { label: string; free: string; plus: string }[] {
  const can = (ok: boolean, yes = "가능") => (ok ? yes : "불가");
  const both = (f: (l: PlanLimits) => string) => ({ free: f(free), plus: f(plus) });
  return [
    { label: "매일 맹고", ...both((l) => `${l.dailyItems}개`) },
    { label: "음성 듣기", ...both((l) => can(l.audio)) },
    { label: "관심사 추가", ...both((l) => can(l.customLimit > 0, `${l.customLimit}개`)) },
    { label: "맹고 추가 구매", ...both((l) => can(l.canBuyMaengo)) },
  ];
}

export default async function PremiumPage() {
  const profile = await requireProfile();
  const [wallet, plans] = await Promise.all([syncWallet(profile.id), getPlans()]);
  const free = plans.get("free")!;
  const plus = plans.get("plus")!;

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-10 border-b-2 border-line bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[600px] items-center px-2">
          <BackButton />
        </div>
      </header>

      <main className="mx-auto max-w-[560px] px-5 pb-[calc(48px+env(safe-area-inset-bottom))] pt-6">
        <section aria-labelledby="premium-title" className="relative overflow-hidden rounded-3xl bg-ink px-6 pb-6 pt-6 text-white shadow-[0_6px_0_#11142A]">
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
              <p className="mt-1 text-[15px] font-semibold leading-snug text-white/75">매일 {plus.dailyItems}개 소식, 귀로도 들어요</p>
            </div>
            <span className="flex size-[88px] shrink-0 items-center justify-center rounded-full bg-mango">
              <Mascot mood="listen" className="size-[76px]" />
            </span>
          </div>
          {discountPct(plus) > 0 && (
            <p className="relative mt-6 flex items-center gap-2">
              <del className="font-round text-[17px] font-bold text-white/50">{plus.listPriceKrw!.toLocaleString("ko-KR")}원</del>
              <span className="rounded-lg bg-orange px-2 py-0.5 font-round text-[13px] font-black text-white">{discountPct(plus)}% 할인</span>
            </p>
          )}
          <p className={`relative flex items-baseline gap-1.5 ${discountPct(plus) > 0 ? "mt-1.5" : "mt-6"}`}>
            <span className="font-round text-[34px] font-black leading-none tracking-[-0.02em] text-mango">{plus.priceKrw.toLocaleString("ko-KR")}원</span>
            <span className="text-[15px] font-bold text-white/60">/ 월</span>
          </p>
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
          <PremiumBuy uid={profile.id} plan={profile.plan} />
        </div>

        <section id="maengo" aria-labelledby="maengo-title" className="mt-12 scroll-mt-20">
          <h2 id="maengo-title" className="text-[20px] font-black tracking-[-0.02em]">
            맹고 채우기
          </h2>
          <p className="mb-3 mt-1 text-[14px] leading-relaxed text-sub">1맹고로 오늘 소식을 하나 더 받아요. 추가 구매한 맹고는 지갑에 들어가 사라지지 않아요.</p>
          <MaengoShop uid={profile.id} canBuy={profile.limits.canBuyMaengo} wallet={wallet} />
        </section>

        <RestorePurchases uid={profile.id} />
      </main>
    </div>
  );
}
