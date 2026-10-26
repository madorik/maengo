import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { flagBillingWebhookFailure } from "@/lib/server/admin-alerts";
import { billingConfigured, clawbackRefund, recordBillingEvent, syncBilling } from "@/lib/server/billing";
import type { RcEvent } from "@/lib/billing/revenuecat";

// RevenueCat 웹훅(구매·갱신·해지·만료·환불 등). 대시보드에 Authorization 값으로 `Bearer {REVENUECAT_WEBHOOK_AUTH}`를 넣는다.
// 원본 이벤트와 돈이 오간 거래는 문의 대응용으로 남기고(billing_events·purchases), 플랜·지갑은 내용을 믿지 않고
// 누구의 일인지만 본 뒤 RevenueCat에서 그 사람 상태를 다시 읽어 맞춘다(lib/server/billing.ts).
// 실패하면 500으로 답해 RevenueCat이 다시 보내게 하고, 관리자 화면 알림 종에 띄운다(lib/server/admin-alerts.ts).
// 맹고 묶음 환불(CANCELLATION)은 넣었던 맹고를 한 번 회수한다(clawbackRefund). 구매는 회원 사이에 저절로 옮기지 않는다(BILLING.md 구매 복원):
// 그래도 옮기기(TRANSFER)가 오면 내준 쪽·받은 쪽을 모두 다시 맞춘다(내준 쪽은 권한이 없어져 Free로).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH?.trim();
  if (!secret) {
    // 결제는 켰는데(RevenueCat 서버 키 있음) 웹훅 비밀값만 빠짐: 모든 결제 웹훅을 놓친다. 결제를 켜기 전엔 아무나 보내도 알리지 않는다
    if (billingConfigured()) await flagBillingWebhookFailure("REVENUECAT_WEBHOOK_AUTH가 비어 있어 웹훅을 받지 못함").catch(() => {});
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { event?: RcEvent & Record<string, unknown> } | null;
  const event = body?.event;
  if (!event) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (event.type === "TEST") return NextResponse.json({ ok: true });

  // 우리 회원 id(익명 $RCAnonymousID는 뺀다). 옮기기(TRANSFER)는 내준 사람과 옮겨 간 사람을 모두 맞춘다
  const ids = new Set(
    [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? []), ...(event.transferred_from ?? []), ...(event.transferred_to ?? [])].filter(
      (id): id is string => !!id && UUID.test(id),
    ),
  );
  const owner = event.app_user_id && UUID.test(event.app_user_id) ? event.app_user_id : ([...ids][0] ?? null);
  await recordBillingEvent(event, owner);
  try {
    await clawbackRefund(event, owner);
    for (const id of ids) await syncBilling(id, `webhook:${event.type ?? "?"}`);
  } catch (e) {
    const message = String((e as Error).message ?? e).slice(0, 300);
    console.error("[billing] 웹훅 처리 실패", event.type, message);
    Sentry.captureException(e, { tags: { where: "billing:webhook", event: String(event.type ?? "?") } });
    const who = [...ids].map((id) => id.slice(0, 8)).join(",");
    await flagBillingWebhookFailure(`${event.type ?? "?"} 회원 ${who || "없음"}: ${message.slice(0, 160)}`).catch(() => {});
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
