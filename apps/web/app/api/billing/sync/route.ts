import { NextResponse } from "next/server";
import { billingConfigured, syncBilling } from "@/lib/server/billing";
import { currentProfile } from "@/lib/server/session";

/** 앱이 결제·복원을 마친 직후 부른다. 웹훅을 기다리지 않고 바로 플랜·추가 구매한 맹고를 맞춘다 */
export async function POST() {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!billingConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  try {
    return NextResponse.json(await syncBilling(profile.id));
  } catch (e) {
    console.error("[billing] sync 실패", String((e as Error).message ?? e).slice(0, 300));
    return NextResponse.json({ error: "sync_failed" }, { status: 502 });
  }
}
