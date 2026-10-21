import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { kstDate } from "@maengo/core/kst";
import { GrowthTab } from "@/components/admin/GrowthTab";
import { OpsTab } from "@/components/admin/OpsTab";
import { RangeBar, Tabs } from "@/components/admin/parts";
import { RevenueTab } from "@/components/admin/RevenueTab";
import { parseAdminRange, parseAdminTab } from "@/lib/admin-range";
import { isAdmin } from "@/lib/server/admin";
import { adminAlerts } from "@/lib/server/admin-alerts";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

// 관리자 통계(TODO.md 1번). 탭 셋(?tab=): 가입·활동(처음), 매출·콘텐츠(revenue), 운영(ops). 연 탭의 숫자만 DB 함수 하나로 센다
// (components/admin/*Tab.tsx, supabase/migrations/20261022100000_admin_tabs.sql). 날짜는 한국 시간.
// 기간(?from=&to=, 기본 오늘까지 14일)은 탭을 옮겨도 그대로. 맨 위 빨간 줄(운영 경고)은 어느 탭에서나 보인다.
// 개인을 알아볼 수 있는 값(이메일·이름)은 보여 주지 않는다.

type Props = { searchParams: Promise<{ tab?: string | string[]; from?: string | string[]; to?: string | string[] }> };

export default async function AdminPage({ searchParams }: Props) {
  const profile = await requireProfile();
  if (!isAdmin(profile)) notFound();
  const today = kstDate();
  const sp = await searchParams;
  const range = parseAdminRange(sp, today);
  const tab = parseAdminTab(sp);

  return (
    <div className="min-h-dvh bg-snow">
      <header className="border-b-2 border-line bg-paper">
        <div className="mx-auto max-w-[1100px] px-5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-black tracking-[-0.02em]">맹고 관리자</h1>
              <p className="text-[13px] font-semibold text-sub">{today} 기준(한국 시간), 새로고침하면 다시 센다</p>
            </div>
            <Link href="/today" className="btn btn-ghost min-h-11 px-4 text-[14px]">
              앱으로
            </Link>
          </div>
          <div className="mt-3">
            <Tabs tab={tab} range={range} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-5 py-6">
        <Alerts />
        <RangeBar tab={tab} range={range} today={today} />
        {tab === "growth" && <GrowthTab range={range} today={today} />}
        {tab === "revenue" && <RevenueTab range={range} />}
        {tab === "ops" && <OpsTab range={range} />}
      </main>
    </div>
  );
}

/** 운영 경고(빨간 줄). 따로 떼어 탭 숫자와 동시에 읽는다 */
async function Alerts() {
  const alerts = await adminAlerts();
  return alerts.map((a) => (
    <div key={a.title} role="alert" className="rounded-2xl border-2 border-orange bg-[#FFF1E6] px-5 py-4 dark:bg-[#3A2414]">
      <p className="text-[16px] font-black text-orange">{a.title}</p>
      <p className="mt-1 text-[14px] font-semibold text-ink">{a.detail}</p>
    </div>
  ));
}
