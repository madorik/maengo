// Play 인앱 상품 만들기(BILLING.md '상품' 표, asc-products.mjs의 Play판). node play-products.mjs
// 구독 maengo_premium_monthly(기본 요금제 monthly: 매월 자동 갱신 ₩3,800, 혜택 free-trial-7d: 신규 고객 7일 무료) + 일회성 maengo_pack_10·30·50·100.
// 이미 있는 것은 건너뛰고 활성화만 맞춘다(여러 번 돌려도 된다). 가격은 한국(KR) 기준이고 다른 나라는 구글 환산 가격으로 맞춘다.
// 판매자 계정(결제 프로필)이 없으면 만들기에서 오류가 난다.
import { play, PKG } from "./stores.mjs";

const PREMIUM = { productId: "maengo_premium_monthly", basePlanId: "monthly", offerId: "free-trial-7d", title: "맹고 Premium", description: "하루 소식 10개, 음성 듣기, 관심사 20개", krw: 3800 };
const PACKS = [
  { n: 10, krw: 1100 },
  { n: 30, krw: 2900 },
  { n: 50, krw: 4400 },
  { n: 100, krw: 7900 },
].map(({ n, krw }) => ({ productId: `maengo_pack_${n}`, title: `맹고 ${n}개`, description: `오늘 소식을 하나 더 받을 때 쓰는 맹고 ${n}개`, krw }));

/** 한국 가격을 모든 나라 가격으로(한국은 그대로) */
async function prices(krw) {
  const r = await play("POST", "/pricing:convertRegionPrices", { price: { currencyCode: "KRW", units: String(krw) } });
  const regions = Object.values(r.convertedRegionPrices).map((x) => ({ regionCode: x.regionCode, price: x.price }));
  const kr = regions.find((x) => x.regionCode === "KR");
  if (kr) kr.price = { currencyCode: "KRW", units: String(krw) };
  else regions.push({ regionCode: "KR", price: { currencyCode: "KRW", units: String(krw) } });
  // 나라 목록 버전은 환산이 쓴 것과 같아야 한다(다르면 'Invalid currency for region code')
  return { regions, other: r.convertedOtherRegionsPrice, rv: `regionsVersion.version=${r.regionVersion.version}` };
}

// ---------- 구독 ----------
async function subscription() {
  const p = PREMIUM;
  const { regions, other, rv } = await prices(p.krw);
  let sub = ((await play("GET", "/subscriptions"))?.subscriptions ?? []).find((s) => s.productId === p.productId);
  if (!sub) {
    sub = await play("POST", `/subscriptions?productId=${p.productId}&${rv}`, {
      packageName: PKG,
      productId: p.productId,
      listings: [{ languageCode: "ko-KR", title: p.title, description: p.description }],
      basePlans: [
        {
          basePlanId: p.basePlanId,
          autoRenewingBasePlanType: { billingPeriodDuration: "P1M", legacyCompatible: true },
          regionalConfigs: regions.map((x) => ({ ...x, newSubscriberAvailability: true })),
          ...(other && { otherRegionsConfig: { usdPrice: other.usdPrice, eurPrice: other.eurPrice, newSubscriberAvailability: true } }),
        },
      ],
    });
    console.log("구독 만듦:", p.productId);
  }
  const base = sub.basePlans.find((b) => b.basePlanId === p.basePlanId);
  if (base.state !== "ACTIVE") {
    await play("POST", `/subscriptions/${p.productId}/basePlans/${p.basePlanId}:activate`, {});
    console.log("기본 요금제 활성화:", p.basePlanId);
  }

  const offers = (await play("GET", `/subscriptions/${p.productId}/basePlans/${p.basePlanId}/offers`))?.subscriptionOffers ?? [];
  let offer = offers.find((o) => o.offerId === p.offerId);
  if (!offer) {
    offer = await play("POST", `/subscriptions/${p.productId}/basePlans/${p.basePlanId}/offers?offerId=${p.offerId}&${rv}`, {
      packageName: PKG,
      productId: p.productId,
      basePlanId: p.basePlanId,
      offerId: p.offerId,
      // 이 구독을 산 적 없는 사람만(BILLING.md D3)
      targeting: { acquisitionRule: { scope: { thisSubscription: {} } } },
      phases: [{ recurrenceCount: 1, duration: "P7D", regionalConfigs: regions.map((x) => ({ regionCode: x.regionCode, free: {} })), ...(other && { otherRegionsConfig: { free: {} } }) }],
      regionalConfigs: regions.map((x) => ({ regionCode: x.regionCode, newSubscriberAvailability: true })),
      ...(other && { otherRegionsConfig: { otherRegionsNewSubscriberAvailability: true } }),
    });
    console.log("무료 체험 혜택 만듦:", p.offerId);
  }
  if (offer.state !== "ACTIVE") {
    await play("POST", `/subscriptions/${p.productId}/basePlans/${p.basePlanId}/offers/${p.offerId}:activate`, {});
    console.log("무료 체험 혜택 활성화:", p.offerId);
  }
}

// ---------- 맹고 묶음(일회성) ----------
async function packs() {
  const existing = (await play("GET", "/oneTimeProducts"))?.oneTimeProducts ?? [];
  for (const p of PACKS) {
    let prod = existing.find((x) => x.productId === p.productId);
    if (!prod) {
      const { regions, other, rv } = await prices(p.krw);
      // 만들기·수정만 경로가 소문자다(API 문서 그대로)
      prod = await play("PATCH", `/onetimeproducts/${p.productId}?allowMissing=true&updateMask=listings,purchaseOptions&${rv}`, {
        packageName: PKG,
        productId: p.productId,
        listings: [{ languageCode: "ko-KR", title: p.title, description: p.description }],
        purchaseOptions: [
          {
            purchaseOptionId: "buy",
            buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
            regionalPricingAndAvailabilityConfigs: regions.map((x) => ({ ...x, availability: "AVAILABLE" })),
            ...(other && { newRegionsConfig: { usdPrice: other.usdPrice, eurPrice: other.eurPrice, availability: "AVAILABLE" } }),
          },
        ],
      });
      console.log("묶음 만듦:", p.productId);
    }
    const opt = prod.purchaseOptions?.[0];
    if (opt && opt.state !== "ACTIVE") {
      await play("POST", `/oneTimeProducts/${p.productId}/purchaseOptions:batchUpdateStates`, {
        requests: [{ activatePurchaseOptionRequest: { packageName: PKG, productId: p.productId, purchaseOptionId: opt.purchaseOptionId } }],
      });
      console.log("묶음 활성화:", p.productId);
    }
  }
}

await subscription();
await packs();
const subs = (await play("GET", "/subscriptions"))?.subscriptions ?? [];
for (const s of subs) for (const b of s.basePlans) console.log(" ", s.productId, b.basePlanId, b.state);
for (const x of (await play("GET", "/oneTimeProducts"))?.oneTimeProducts ?? []) console.log(" ", x.productId, x.purchaseOptions?.map((o) => o.state).join(","));
