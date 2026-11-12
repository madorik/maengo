// 맹고 묶음(소모성 maengo_pack_10·30·50·100) 판매 중지(2026-11-12: 맹고 재화를 없앴다). node packs-off.mjs [play|asc]
// Play: 구매 옵션을 비활성화한다. App Store: 판매 지역을 비운다(모든 나라에서 내림). 구독(maengo_premium_monthly)은 건드리지 않는다.
// 상품 자체는 지우지 않는다(이미 산 기록·환불 대비). 여러 번 돌려도 된다
import { asc, APP_ID, play, PKG } from "./stores.mjs";

const IDS = [10, 30, 50, 100].map((n) => `maengo_pack_${n}`);
const only = process.argv[2];

async function playOff() {
  const all = (await play("GET", "/oneTimeProducts"))?.oneTimeProducts ?? [];
  for (const id of IDS) {
    const prod = all.find((x) => x.productId === id);
    if (!prod) {
      console.log("Play 없음", id);
      continue;
    }
    for (const opt of prod.purchaseOptions ?? []) {
      if (opt.state === "INACTIVE") {
        console.log("Play 이미 비활성", id, opt.purchaseOptionId);
        continue;
      }
      await play("POST", `/oneTimeProducts/${id}/purchaseOptions:batchUpdateStates`, {
        requests: [{ deactivatePurchaseOptionRequest: { packageName: PKG, productId: id, purchaseOptionId: opt.purchaseOptionId } }],
      });
      console.log("Play 비활성", id, opt.purchaseOptionId);
    }
  }
  for (const x of (await play("GET", "/oneTimeProducts"))?.oneTimeProducts ?? []) console.log("  Play", x.productId, x.purchaseOptions?.map((o) => o.state).join(","));
}

async function ascOff() {
  const list = (await asc("GET", `/v1/apps/${APP_ID}/inAppPurchasesV2?limit=200`)).data;
  for (const id of IDS) {
    const iap = list.find((x) => x.attributes.productId === id);
    if (!iap) {
      console.log("ASC 없음", id);
      continue;
    }
    // 판매 지역을 빈 목록으로 다시 정하면 모든 나라에서 내려간다
    await asc("POST", "/v1/inAppPurchaseAvailabilities", {
      data: {
        type: "inAppPurchaseAvailabilities",
        attributes: { availableInNewTerritories: false },
        relationships: { inAppPurchase: { data: { type: "inAppPurchases", id: iap.id } }, availableTerritories: { data: [] } },
      },
    });
    console.log("ASC 판매 지역 비움", id, iap.attributes.state);
  }
}

if (!only || only === "play") await playOff();
if (!only || only === "asc") await ascOff();
