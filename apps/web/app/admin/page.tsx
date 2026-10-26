import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { kstDate } from "@maengo/core/kst";
import { AlertBell } from "@/components/admin/AlertBell";
import { GrowthTab } from "@/components/admin/GrowthTab";
import { InquiriesCard } from "@/components/admin/InquiriesCard";
import { OpsTab } from "@/components/admin/OpsTab";
import { RangeBar, Tabs } from "@/components/admin/parts";
import { RevenueTab } from "@/components/admin/RevenueTab";
import { parseAdminRange, parseAdminTab } from "@/lib/admin-range";
import { isAdmin } from "@/lib/server/admin";
import { adminAlerts } from "@/lib/server/admin-alerts";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "관리자", robots: { index: false, follow: false } };

// 관리자 통계(TODO.md 1번). 탭 넷(?tab=): 가입·활동(처음), 매출·콘텐츠(revenue), 운영(ops), 문의(inquiries, 문의하기 답장). 연 탭의 숫자만 DB 함수 하나로 센다
// (components/admin/*Tab.tsx, supabase/migrations/20261022100000_admin_tabs.sql). 날짜는 한국 시간.
// 기간(?from=&to=, 기본 오늘까지 14일)은 탭을 옮겨도 그대로. 운영 경고는 위 막대의 알림 종에 모은다(어느 탭에서나, 안 읽은 게 있으면 빨간 점).
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
            <div className="relative flex items-center gap-2">
              {/* 경고는 탭 숫자와 따로 읽는다(종이 늦게 떠도 화면은 먼저 보이게). 종 목록은 이 줄 오른쪽 끝에 붙는다 */}
              <Suspense fallback={<AlertBell alerts={[]} />}>
                <Alerts />
              </Suspense>
              <Link href="/today" className="btn btn-ghost min-h-11 px-4 text-[14px]">
                앱으로
              </Link>
            </div>
          </div>
          <div className="mt-3">
            <Tabs tab={tab} range={range} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-5 py-6">
        <RangeBar tab={tab} range={range} today={today} />
        {tab === "growth" && <GrowthTab range={range} today={today} />}
        {tab === "revenue" && <RevenueTab range={range} />}
        {tab === "ops" && <OpsTab range={range} />}
        {tab === "inquiries" && <InquiriesCard range={range} />}
      </main>
    </div>
  );
}

/** 운영 경고 → 알림 종 */
async function Alerts() {
  return <AlertBell alerts={await adminAlerts()} />;
}
