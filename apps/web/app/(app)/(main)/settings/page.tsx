import type { Metadata } from "next";
import { headers } from "next/headers";
import { Crown } from "@/components/icons";
import Link from "next/link";
import { PlanSync } from "@/components/app/PlanSync";
import { DarkModeSwitch } from "@/components/settings/DarkModeSwitch";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { ListenPrefs } from "@/components/settings/ListenPrefs";
import { NotifyTimePicker } from "@/components/settings/NotifyTimePicker";
import { BillingBanner } from "@/components/premium/BillingBanner";
import { ManageSubscription, TrialLine } from "@/components/premium/StoreParts";
import { billingNoticeOf } from "@/lib/billing/notice";
import { subscriptionView } from "@/lib/server/billing";
import { PushToggle } from "@/components/settings/PushToggle";
import { PersonalInsightToggle } from "@/components/settings/PersonalInsightToggle";
import { MyContext } from "@/components/settings/MyContext";
import { personalOn } from "@/lib/context";
import { getUserContext } from "@/lib/server/user-context";
import { Section } from "@/components/settings/Section";
import { demoRebuildFeed, demoReset } from "@/app/actions";
import { dailyMaengoUsage, toProfileView } from "@/lib/server/feed";
import { requireProfile } from "@/lib/server/session";
import { demoToolsEnabled, isDemoAccount } from "@/lib/server/demo";
import { webPushTokens } from "@/lib/server/profile";
import { appInfoOf } from "@/lib/app-client";
import { storeReviewUrl } from "@/lib/site";
import { WEB_VERSION } from "@/lib/server/web-version";
import { IconChevronRight } from "@/components/icons";
import { BusinessInfo } from "@/components/public/BusinessInfo";

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  const profile = await requireProfile();
  const demoTools = demoToolsEnabled();
  // 2026-11-12 맹고(재화)를 걷어 내서 지갑 칸·지갑 내역은 뺐다(지갑 표와 결제 기록은 남겨 둔다)
  const [webTokens, usage, sub] = await Promise.all([
    webPushTokens(profile.id),
    dailyMaengoUsage(profile),
    subscriptionView(profile.id),
  ]);
  const view = toProfileView(profile);
  const ctx = await getUserContext(profile.id).catch(() => ({}));
  const notice = billingNoticeOf(sub);
  const pastDue = notice?.kind === "past_due" ? notice : null;
  const ua = (await headers()).get("user-agent");
  const app = appInfoOf(ua);
  const version = app ? `앱 ${app.version} · 웹 ${WEB_VERSION}` : `웹 ${WEB_VERSION}`;
  const rateUrl = storeReviewUrl(app?.platform ?? null);

  return (
    <div className="mx-auto max-w-[640px] px-5 py-8 lg:py-12">
      <h1 className="text-[28px] font-black tracking-[-0.03em]">설정</h1>

      <div className="mt-6">
        <Section id="plan" title="플랜">
          <PlanSync plan={profile.plan} />
          {/* 내 플랜 이름, 오른쪽 끝에 Free면 Premium 알아보기(결제는 /premium), Premium이면 구독 관리(앱에서만) */}
          <div className="flex min-h-12 items-center justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-[22px] font-black tracking-[-0.02em]">
              {view.plan !== "free" && <Crown className="size-6" />}
              {profile.limits.name}
            </p>
            {view.plan === "free" ? (
              <Link href="/premium" className="btn min-h-11 shrink-0 px-4 text-[14px]">
                <Crown className="size-4" />
                Premium 알아보기
              </Link>
            ) : (
              <ManageSubscription uid={profile.id} />
            )}
          </div>
          {/* 무료 체험 중이면 첫 결제일(해지했으면 끝나는 날) */}
          {view.plan !== "free" && <TrialLine uid={profile.id} sub={sub} />}
          {/* 갱신 결제가 실패했으면 결제 수단 확인(오늘 화면 맨 위와 같은 띠). 체험이 곧 끝나는 건 위 줄과 구독 관리가 이미 보여 준다 */}
          <BillingBanner notice={pastDue} uid={profile.id} className="mt-3" />
          <div className="mt-4">
            <div className="tile p-4">
              <p className="text-[13px] font-extrabold text-sub">오늘 받은 소식</p>
              {/* 오늘 지급한 소식 / 오늘 받을 수 있는 수(출근길·퇴근길 브리핑 두 번) */}
              <p className="font-round text-[26px] font-black leading-tight tabular-nums">
                {usage.given}
                <span className="text-[16px] text-sub">/{usage.daily}</span>
              </p>
            </div>
          </div>
        </Section>

        <Section id="listen" title="목소리">
          <ListenPrefs />
        </Section>

        <Section id="notify" title="알림" action={<PushToggle enabled={profile.pushEnabled} webTokens={webTokens} />}>
          {/* 하루 두 번 브리핑(2026-11-10): 출근길·퇴근길 알림 시각. 기본 07:00·18:00, 여기서 바꾼다 */}
          <p className="mb-2 mt-1 text-[14px] font-semibold text-sub">출근길 브리핑</p>
          <NotifyTimePicker current={profile.notifyAt} slot="am" />
          <p className="mb-2 mt-5 text-[14px] font-semibold text-sub">퇴근길 브리핑</p>
          <NotifyTimePicker current={profile.notifyAtPm} slot="pm" />
        </Section>

        {/* 맞춤 인사이트(2026-11-11): 끄면 내 맞춤 정보·최근 본 소식을 오늘의 흐름에 쓰지 않는다(개인정보 처리방침 5조 국외 이전 거부 방법) */}
        <Section id="personal" title="맞춤 인사이트" action={<PersonalInsightToggle on={personalOn(ctx)} />}>
          <p className="mt-1 text-[14px] leading-relaxed text-sub">
            내 맞춤 정보와 최근 본 소식으로 오늘의 흐름과 맞춤 체크를 짚어 드려요. 끄면 소식 요약만으로 만들어요.
          </p>
          {/* 내 맞춤 정보: 소식을 보다 알려 준 답을 보고 바꾸거나 지운다(개인정보 처리방침 3조). 2026-11-11 사용자: 내 관심 키워드엔 보이지 말 것 → 여기 접어 둔다 */}
          <details id="my-context" className="group mt-3 border-t border-line">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              내 맞춤 정보
              <IconChevronRight className="size-4 text-faint transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            </summary>
            <div className="pb-1 pt-1">
              <MyContext ctx={ctx} />
            </div>
          </details>
        </Section>

        <Section id="display" title="화면">
          <DarkModeSwitch />
        </Section>

        <Section id="account" title="계정">
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[15px] font-bold">
            <Link href="/terms" className="text-sub no-underline hover:text-ink hover:underline">
              이용약관
            </Link>
            <Link href="/privacy" className="text-sub no-underline hover:text-ink hover:underline">
              개인정보 처리방침
            </Link>
          </p>
          <DeleteAccount demo={isDemoAccount(profile.id)} />
        </Section>

        <Section id="about" title="앱 정보">
          <div className="divide-y-2 divide-line">
            {/* 문의하기 양식(/contact). 회원 번호·플랜·최근 결제·앱 버전은 서버가 붙인다 */}
            <Link href="/contact" className="flex min-h-12 items-center justify-between gap-3 font-bold text-ink no-underline hover:underline">
              문의하기
              <IconChevronRight className="size-4 text-sub" />
            </Link>
            {/* 스토어 리뷰 쓰기(2026-11-06). 대가 없이 부탁만 한다(애플·구글 정책). Play는 출시 뒤 PLAY_STORE_URL을 채우면 안드로이드 앱에도 나온다 */}
            {rateUrl && (
              <a href={rateUrl} target="_blank" rel="noopener" className="flex min-h-12 items-center justify-between gap-3 font-bold text-ink no-underline hover:underline">
                맹고 평가하기
                <IconChevronRight className="size-4 text-sub" />
              </a>
            )}
            <p className="flex min-h-12 items-center justify-between gap-3 font-bold">
              버전
              <span className="font-round text-[15px] text-sub tabular-nums">{version}</span>
            </p>
            {/* 사업자 정보(전자상거래법 표시). 평소엔 접어 둔다 */}
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink [&::-webkit-details-marker]:hidden">
                사업자 정보
                <IconChevronRight className="size-4 text-sub transition-transform group-open:rotate-90" />
              </summary>
              <BusinessInfo className="flex flex-col gap-0.5 pb-4 text-[13px] font-semibold leading-relaxed text-sub" />
            </details>
          </div>
        </Section>

        {demoTools && (
          <Section id="demo" title="데모 도구">
            <p className="text-sub">이미 요약된 소식으로 오늘 피드를 다시 골라요. AI를 새로 부르지 않아요.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={demoRebuildFeed}>
                <button type="submit" className="btn btn-ghost min-h-11 px-4 text-[14px]">
                  오늘 피드 다시 고르기
                </button>
              </form>
              <form action={demoReset}>
                <button type="submit" className="btn btn-ghost min-h-11 px-4 text-[14px]">
                  처음 상태로 되돌리기
                </button>
              </form>
            </div>
            <p className="mt-2 text-[13px] text-sub">
              다시 고르면 지난 피드에 나온 소식, 읽거나 들은 소식, 싫어요를 누른 소식을 빼고 골라요.
              처음 상태로 되돌리면 읽음·피드백을 지우고 관심사 가중치를 1로 돌려요.
            </p>
          </Section>
        )}
      </div>
    </div>
  );
}
