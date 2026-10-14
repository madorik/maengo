import { NextResponse, type NextRequest } from "next/server";
import { syncBilling } from "@/lib/server/billing";

// RevenueCat 웹훅(구매·갱신·해지·만료·환불 등). 대시보드에 Authorization 값으로 `Bearer {REVENUECAT_WEBHOOK_AUTH}`를 넣는다.
// 내용은 믿지 않고 누구의 일인지만 본 뒤 RevenueCat에서 그 사람 상태를 다시 읽어 맞춘다(lib/server/billing.ts).
// 실패하면 500으로 답해 RevenueCat이 다시 보내게 한다.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { event?: { type?: string; app_user_id?: string; original_app_user_id?: string; aliases?: string[]; transferred_to?: string[] } } | null;
  const event = body?.event;
  if (!event) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (event.type === "TEST") return NextResponse.json({ ok: true });

  // 우리 회원 id(익명 $RCAnonymousID는 뺀다). 옮기기(TRANSFER)는 옮겨 간 사람도 맞춘다
  const ids = new Set([event.app_user_id, event.original_app_user_id, ...(event.aliases ?? []), ...(event.transferred_to ?? [])].filter((id): id is string => !!id && UUID.test(id)));
  try {
    for (const id of ids) await syncBilling(id);
  } catch (e) {
    console.error("[billing] 웹훅 처리 실패", event.type, String((e as Error).message ?? e).slice(0, 300));
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
