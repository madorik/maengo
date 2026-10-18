// App Store Connect 인앱 상품 만들기(BILLING.md '상품' 표). node asc-products.mjs
// 구독 그룹 '맹고 Premium' → 자동 갱신 구독 maengo_premium_monthly(1개월, ₩3,800, 첫 구독 1주 무료) + 소모성 maengo_pack_10·30·50·100.
// 이미 있는 것은 건너뛴다(여러 번 돌려도 된다). 가격은 한국(KOR) 기준이고 다른 나라는 애플 환산 가격으로 맞춘다.
// 심사용 스크린숏은 따로: node asc-products.mjs --shot <구독 화면 png> [묶음 화면 png]
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { asc, APP_ID } from "./stores.mjs";

const PREMIUM = {
  productId: "maengo_premium_monthly",
  name: "맹고 Premium",
  description: "하루 소식 10개, 음성 듣기, 관심사 20개",
  krw: 3800,
  reviewNote:
    "Premium monthly subscription. Unlocks 10 daily news summaries, text-to-speech listening, and up to 20 topics. New subscribers get a 7-day free trial. Purchase: Settings > 플랜 > Premium, or the 요금 tab.",
};
const PACKS = [
  { n: 10, krw: 1100 },
  { n: 30, krw: 2900 },
  { n: 50, krw: 4400 },
  { n: 100, krw: 7900 },
].map(({ n, krw }) => ({
  productId: `maengo_pack_${n}`,
  name: `맹고 ${n}개`,
  description: `오늘 소식을 하나 더 받을 때 쓰는 맹고 ${n}개`,
  krw,
  reviewNote: `Consumable pack of ${n} "maengo" (in-app currency). 1 maengo = one extra news summary today. Purchase: Settings > 지갑 > 추가 구매.`,
}));

const rel = (type, id) => ({ data: { type, id } });
const post = (path, type, attributes, relationships) => asc("POST", path, { data: { type, attributes, relationships } });

async function all(path) {
  const out = [];
  let next = path;
  while (next) {
    const r = await asc("GET", next.replace("https://api.appstoreconnect.apple.com", ""));
    out.push(...r.data);
    next = r.links?.next;
  }
  return out;
}

const territories = (await all("/v1/territories?limit=200")).map((t) => t.id);

async function pricePoint(path, krw) {
  const pts = await all(`${path}?filter[territory]=KOR&limit=200`);
  const p = pts.find((x) => Number(x.attributes.customerPrice) === krw);
  if (!p) {
    const near = pts.map((x) => Number(x.attributes.customerPrice)).sort((a, b) => Math.abs(a - krw) - Math.abs(b - krw)).slice(0, 3);
    throw new Error(`KOR ₩${krw} 가격 없음. 가까운 값: ${near.join(", ")}`);
  }
  return p;
}

// ---------- 구독 ----------
async function subscription() {
  let group = (await all(`/v1/apps/${APP_ID}/subscriptionGroups?limit=50`)).find((g) => g.attributes.referenceName === "맹고 Premium");
  if (!group) {
    group = (await post("/v1/subscriptionGroups", "subscriptionGroups", { referenceName: "맹고 Premium" }, { app: rel("apps", APP_ID) })).data;
    console.log("구독 그룹 만듦", group.id);
  }
  const glocs = await all(`/v1/subscriptionGroups/${group.id}/subscriptionGroupLocalizations`);
  if (!glocs.some((l) => l.attributes.locale === "ko")) {
    await post("/v1/subscriptionGroupLocalizations", "subscriptionGroupLocalizations", { name: "맹고 Premium", locale: "ko" }, { subscriptionGroup: rel("subscriptionGroups", group.id) });
    console.log("구독 그룹 한국어 이름");
  }

  let sub = (await all(`/v1/subscriptionGroups/${group.id}/subscriptions`)).find((s) => s.attributes.productId === PREMIUM.productId);
  if (!sub) {
    sub = (
      await post(
        "/v1/subscriptions",
        "subscriptions",
        { name: PREMIUM.name, productId: PREMIUM.productId, subscriptionPeriod: "ONE_MONTH", familySharable: false, groupLevel: 1, reviewNote: PREMIUM.reviewNote },
        { group: rel("subscriptionGroups", group.id) },
      )
    ).data;
    console.log("구독 만듦", sub.id);
  }
  const s = `/v1/subscriptions/${sub.id}`;

  if (!(await all(`${s}/subscriptionLocalizations`)).some((l) => l.attributes.locale === "ko")) {
    await post("/v1/subscriptionLocalizations", "subscriptionLocalizations", { name: PREMIUM.name, locale: "ko", description: PREMIUM.description }, { subscription: rel("subscriptions", sub.id) });
    console.log("구독 한국어 이름·설명");
  }

  const avail = await asc("GET", `${s}/subscriptionAvailability`).catch(() => null);
  if (!avail?.data) {
    await asc("POST", "/v1/subscriptionAvailabilities", {
      data: {
        type: "subscriptionAvailabilities",
        attributes: { availableInNewTerritories: true },
        relationships: { subscription: rel("subscriptions", sub.id), availableTerritories: { data: territories.map((id) => ({ type: "territories", id })) } },
      },
    });
    console.log("구독 판매 국가:", territories.length);
  }

  // 가격: 한국 ₩3,800, 다른 나라는 애플 환산 가격
  const have = new Set((await all(`${s}/prices?limit=200&include=territory`)).map((p) => p.relationships?.territory?.data?.id).filter(Boolean));
  const kor = await pricePoint(`${s}/pricePoints`, PREMIUM.krw);
  const eq = await all(`/v1/subscriptionPricePoints/${kor.id}/equalizations?limit=200&include=territory`);
  const points = [{ id: kor.id, territory: "KOR" }, ...eq.map((p) => ({ id: p.id, territory: p.relationships.territory.data.id }))];
  let added = 0;
  for (const p of points) {
    if (have.has(p.territory)) continue;
    await asc("POST", "/v1/subscriptionPrices", {
      data: {
        type: "subscriptionPrices",
        attributes: { preserveCurrentPrice: false },
        relationships: { subscription: rel("subscriptions", sub.id), subscriptionPricePoint: rel("subscriptionPricePoints", p.id), territory: rel("territories", p.territory) },
      },
    });
    added++;
  }
  console.log(`구독 가격: KOR ₩${kor.attributes.customerPrice}(수익 ₩${kor.attributes.proceeds}), 새로 넣은 나라 ${added}, 전체 ${points.length}`);

  // 첫 구독 1주 무료(유입 혜택). 애플이 구독 그룹마다 계정당 한 번만 준다
  const offers = new Set((await all(`${s}/introductoryOffers?limit=200&include=territory`)).map((o) => o.relationships?.territory?.data?.id).filter(Boolean));
  let trial = 0;
  for (const t of points.map((p) => p.territory)) {
    if (offers.has(t)) continue;
    await asc("POST", "/v1/subscriptionIntroductoryOffers", {
      data: {
        type: "subscriptionIntroductoryOffers",
        attributes: { duration: "ONE_WEEK", offerMode: "FREE_TRIAL", numberOfPeriods: 1 },
        relationships: { subscription: rel("subscriptions", sub.id), territory: rel("territories", t) },
      },
    });
    trial++;
  }
  console.log(`무료 체험 1주: 새로 넣은 나라 ${trial}`);
  return sub;
}

// ---------- 맹고 묶음(소모성) ----------
async function packs() {
  const existing = await all(`/v1/apps/${APP_ID}/inAppPurchasesV2?limit=200`);
  const out = [];
  for (const p of PACKS) {
    let iap = existing.find((x) => x.attributes.productId === p.productId);
    if (!iap) {
      iap = (
        await post(
          "/v2/inAppPurchases",
          "inAppPurchases",
          { name: p.name, productId: p.productId, inAppPurchaseType: "CONSUMABLE", familySharable: false, reviewNote: p.reviewNote },
          { app: rel("apps", APP_ID) },
        )
      ).data;
      console.log("묶음 만듦", p.productId, iap.id);
    }
    const v = `/v2/inAppPurchases/${iap.id}`;
    if (!(await all(`${v}/inAppPurchaseLocalizations`)).some((l) => l.attributes.locale === "ko")) {
      await post("/v1/inAppPurchaseLocalizations", "inAppPurchaseLocalizations", { name: p.name, locale: "ko", description: p.description }, { inAppPurchaseV2: rel("inAppPurchases", iap.id) });
    }
    const avail = await asc("GET", `${v}/inAppPurchaseAvailability`).catch(() => null);
    if (!avail?.data) {
      await asc("POST", "/v1/inAppPurchaseAvailabilities", {
        data: {
          type: "inAppPurchaseAvailabilities",
          attributes: { availableInNewTerritories: true },
          relationships: { inAppPurchase: rel("inAppPurchases", iap.id), availableTerritories: { data: territories.map((id) => ({ type: "territories", id })) } },
        },
      });
    }
    // 가격표는 상품을 만들면 빈 채로 생긴다. 정해 둔 가격(manualPrices)이 있는지로 본다
    const priced = await asc("GET", `${v}/iapPriceSchedule/manualPrices?limit=1`).catch(() => null);
    if (!priced?.data?.length) {
      const kor = await pricePoint(`${v}/pricePoints`, p.krw);
      await asc("POST", "/v1/inAppPurchasePriceSchedules", {
        data: {
          type: "inAppPurchasePriceSchedules",
          relationships: {
            inAppPurchase: rel("inAppPurchases", iap.id),
            baseTerritory: rel("territories", "KOR"),
            manualPrices: { data: [{ type: "inAppPurchasePrices", id: "${kor}" }] },
          },
        },
        included: [{ type: "inAppPurchasePrices", id: "${kor}", attributes: { startDate: null }, relationships: { inAppPurchasePricePoint: rel("inAppPurchasePricePoints", kor.id) } }],
      });
      console.log(`묶음 가격 ${p.productId}: ₩${kor.attributes.customerPrice}(수익 ₩${kor.attributes.proceeds})`);
    }
    out.push(iap);
  }
  return out;
}

// ---------- 심사용 스크린숏(앱의 구매 화면) ----------
async function reviewShot(subPng, packPng = subPng) {
  const upload = async (png, type, relName, relType, id) => {
    const file = readFileSync(png);
    const md5 = createHash("md5").update(file).digest("hex");
    const r = (await post(`/v1/${type}`, type, { fileName: basename(png), fileSize: statSync(png).size }, { [relName]: rel(relType, id) })).data;
    for (const op of r.attributes.uploadOperations) {
      const res = await fetch(op.url, {
        method: op.method,
        headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])),
        body: file.subarray(op.offset, op.offset + op.length),
      });
      if (!res.ok) throw new Error(`스크린숏 올리기 실패 ${res.status}`);
    }
    await asc("PATCH", `/v1/${type}/${r.id}`, { data: { type, id: r.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
  };
  const group = (await all(`/v1/apps/${APP_ID}/subscriptionGroups?limit=50`)).find((g) => g.attributes.referenceName === "맹고 Premium");
  const sub = (await all(`/v1/subscriptionGroups/${group.id}/subscriptions`)).find((s) => s.attributes.productId === PREMIUM.productId);
  const cur = await asc("GET", `/v1/subscriptions/${sub.id}/appStoreReviewScreenshot`).catch(() => null);
  if (!cur?.data) {
    await upload(subPng, "subscriptionAppStoreReviewScreenshots", "subscription", "subscriptions", sub.id);
    console.log("구독 심사용 스크린숏");
  }
  for (const iap of (await all(`/v1/apps/${APP_ID}/inAppPurchasesV2?limit=200`)).filter((x) => x.attributes.productId.startsWith("maengo_pack_"))) {
    const c = await asc("GET", `/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`).catch(() => null);
    if (c?.data) continue;
    await upload(packPng, "inAppPurchaseAppStoreReviewScreenshots", "inAppPurchaseV2", "inAppPurchases", iap.id);
    console.log("묶음 심사용 스크린숏", iap.attributes.productId);
  }
}

const args = process.argv.slice(2);
if (args[0] === "--shot") await reviewShot(args[1], args[2]);
else {
  await subscription();
  await packs();
  const subs = await all(`/v1/apps/${APP_ID}/subscriptionGroups?include=subscriptions&limit=50`);
  console.log("상태:", subs.map((g) => g.attributes.referenceName).join(", "));
  for (const x of await all(`/v1/apps/${APP_ID}/inAppPurchasesV2?limit=200`)) console.log(" ", x.attributes.productId, x.attributes.state);
}
