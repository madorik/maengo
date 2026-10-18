import { krwLabel } from "@maengo/core/plans";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Crown } from "@/components/icons";
import Link from "next/link";
import { PlanSync } from "@/components/app/PlanSync";
import { DarkModeSwitch } from "@/components/settings/DarkModeSwitch";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { LinkSlots } from "@/components/settings/LinkSlots";
import { ListenPrefs } from "@/components/settings/ListenPrefs";
import { NotifyTimePicker } from "@/components/settings/NotifyTimePicker";
import { BillingBanner } from "@/components/premium/BillingBanner";
import { ManageSubscription, TrialLine } from "@/components/premium/StoreParts";
import { WalletHistory } from "@/components/settings/WalletHistory";
import { billingNoticeOf } from "@/lib/billing/notice";
import { subscriptionView } from "@/lib/server/billing";
import { PushToggle } from "@/components/settings/PushToggle";
import { TopicSettings } from "@/components/settings/TopicSettings";
import { demoRebuildFeed, demoReset } from "@/app/actions";
import { dailyMaengoUsage, toProfileView } from "@/lib/server/feed";
import { syncWallet, walletHistory } from "@/lib/server/wallet";
import { requireProfile } from "@/lib/server/session";
import { demoToolsEnabled, isDemoAccount } from "@/lib/server/demo";
import { userLinks } from "@/lib/server/links";
import { entitlements, webPushTokens } from "@/lib/server/profile";
import { newsSections, topicGroups, userTopics } from "@/lib/server/topics";
import { appInfoOf, deviceOf } from "@/lib/app-client";
import { SUPPORT_EMAIL, supportMailHref } from "@/lib/site";

/** 웹 버전: 배포한 커밋(Vercel이 넣는다). 커밋 정보 없이 올린 배포면 배포 id(dpl_…) 앞부분, 로컬은 '개발' */
const WEB_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.VERCEL_DEPLOYMENT_ID?.replace(/^dpl_/, "").slice(0, 7) || "개발";

export const metadata: Metadata = { title: "설정" };



/** 설정 한 묶음. action은 제목 오른쪽에 둔다(알림 켜고 끄기) */
function Section({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t-2 border-line py-7">
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <h2 id={`${id}-title`} className="text-[20px] font-black tracking-[-0.02em]">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3 text-[15px] font-medium leading-[1.7]">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const profile = await requireProfile();
  const demoTools = demoToolsEnabled();
  // 지갑 내역은 지갑을 맞춘 뒤(처음이면 가입 선물이 들어간다) 읽는다
  const walletAndHistory = syncWallet(profile.id).then(async (w) => [w, await walletHistory(profile.id)] as const);
  const [topics, links, webTokens, [wallet, history], usage, sub] = await Promise.all([
    userTopics(profile),
    userLinks(profile),
    webPushTokens(profile.id),
    walletAndHistory,
    dailyMaengoUsage(profile),
    subscriptionView(profile.id),
  ]);
  const view = toProfileView(profile);
  const notice = billingNoticeOf(sub);
  const pastDue = notice?.kind === "past_due" ? notice : null;
  const ua = (await headers()).get("user-agent");
  const app = appInfoOf(ua);
  const version = app ? `앱 ${app.version} · 웹 ${WEB_VERSION}` : `웹 ${WEB_VERSION}`;
  // 문의 메일: 제목과 문제를 찾는 데 쓸 정보를 미리 채운다
  const mailHref = supportMailHref("[맹고 문의]", [
    `앱: ${app ? `${app.version} (${app.platform})` : "웹 브라우저"}`,
    `웹: ${WEB_VERSION}`,
    `기기: ${deviceOf(ua)}`,
    `플랜: ${profile.limits.name}`,
    `회원: ${profile.id.slice(0, 8)}`,
  ]);

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
          {view.plan !== "free" && <TrialLine sub={sub} price={krwLabel(profile.limits.priceKrw)} />}
          {/* 갱신 결제가 실패했으면 결제 수단 확인(오늘 화면 맨 위와 같은 띠). 체험이 곧 끝나는 건 위 줄과 구독 관리가 이미 보여 준다 */}
          <BillingBanner notice={pastDue} uid={profile.id} price={krwLabel(profile.limits.priceKrw)} className="mt-3" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="tile p-4">
              <p className="text-[13px] font-extrabold text-sub">하루 소식</p>
              {/* 오늘 지급한 소식 / 플랜의 하루 소식 */}
              <p className="font-round text-[26px] font-black leading-tight tabular-nums">
                {usage.given}
                <span className="text-[16px] text-faint">/{usage.daily}</span>
              </p>
            </div>
            <div className="tile p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-extrabold text-sub">지갑</p>
                {/* 맹고 추가 구매를 할 수 있는 플랜만(plans 표) */}
                {view.canBuyMaengo && (
                  <Link href="/premium#maengo" className="shrink-0 text-[13px] font-extrabold text-mango-deep no-underline hover:underline">
                    추가 구매
                  </Link>
                )}
              </div>
              {/* 맹고 n개: 숫자만 크게(하루 소식 칸과 같은 모양) */}
              <p className="font-round text-[26px] font-black leading-tight tabular-nums">
                <span className="mr-1 font-sans text-[16px] text-sub">맹고</span>
                {wallet.toLocaleString("ko-KR")}
                <span className="ml-0.5 font-sans text-[16px] text-sub">개</span>
              </p>
            </div>
          </div>
          {/* 지갑이 들고 난 기록(최근 50개) */}
          <WalletHistory entries={history} />
        </Section>

        <Section id="topics" title="관심사">
          <TopicSettings
            groups={topicGroups(topics)}
            news={newsSections(topics)}
            custom={topics.filter((t) => t.custom)}
            customAllowed={entitlements(profile).customLimit > 0}
          />
        </Section>

        <Section id="links" title="내 관심 링크">
          {/* 블로그·사이트 주소 칸 3개(Premium). Free는 Premium 배지, 전에 넣어 둔 링크는 배지와 빼기만 */}
          <LinkSlots links={links} limit={entitlements(profile).linkLimit} />
        </Section>

        <Section id="listen" title="듣기 모드">
          <ListenPrefs audio={view.audio} />
        </Section>

        <Section id="notify" title="알림" action={<PushToggle enabled={profile.pushEnabled} webTokens={webTokens} />}>
          <NotifyTimePicker current={profile.notifyAt} />
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
            {SUPPORT_EMAIL && (
              <a href={mailHref} className="flex min-h-12 items-center justify-between gap-3 font-bold text-ink no-underline hover:underline">
                문의하기
                <span className="min-w-0 truncate text-[14px] text-sub">{SUPPORT_EMAIL}</span>
              </a>
            )}
            <p className="flex min-h-12 items-center justify-between gap-3 font-bold">
              버전
              <span className="font-round text-[15px] text-sub tabular-nums">{version}</span>
            </p>
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
