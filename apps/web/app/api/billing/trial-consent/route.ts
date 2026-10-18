import { NextResponse, type NextRequest } from "next/server";
import { appInfoOf } from "@/lib/app-client";
import { hadSubscription, recordTrialConsent } from "@/lib/server/billing";
import { currentProfile } from "@/lib/server/session";

// 첫 구독의 무료 체험 동의(앱 안 팝업 '동의하고 무료로 시작'). 남긴 뒤에야 앱이 결제 창을 띄운다(components/premium/TrialConsent.tsx).
// 전에 구독한 적이 있으면 체험이 없으므로 받지 않는다(409).
export async function POST(request: NextRequest) {
  const profile = await currentProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const productId = typeof b?.productId === "string" ? b.productId.slice(0, 200) : "";
  const trialDays = typeof b?.trialDays === "number" && Number.isInteger(b.trialDays) && b.trialDays > 0 && b.trialDays <= 31 ? b.trialDays : 0;
  const price = typeof b?.price === "string" ? b.price.slice(0, 40) : "";
  const chargeOn = typeof b?.chargeOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.chargeOn) ? b.chargeOn : "";
  const notice = typeof b?.notice === "string" ? b.notice.slice(0, 2000) : "";
  if (!productId || !trialDays || !price || !chargeOn || !notice) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (await hadSubscription(profile.id)) return NextResponse.json({ error: "not_first_subscription" }, { status: 409 });
  await recordTrialConsent(profile.id, { productId, trialDays, price, chargeOn, platform: appInfoOf(request.headers.get("user-agent"))?.platform ?? null, notice });
  return NextResponse.json({ ok: true });
}
