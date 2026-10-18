// RevenueCat 상품·권한·오퍼링을 한 번에 만든다(API v2). 이미 있는 건 건너뛰어서 여러 번 돌려도 된다.
// 실행: pnpm revenuecat:setup [앱 종류]   앱 종류는 test_store(기본, 로컬 결제 시험)·app_store·play_store
// 필요한 값(apps/web/.env.local): REVENUECAT_PROJECT_ID, REVENUECAT_API_V2_KEY(v2 비밀 키, Project configuration 읽기·쓰기)
// 상품 ID·맹고 수는 packages/core/src/plans.ts(PREMIUM_PRODUCT·MAENGO_PACKS)와 같아야 한다. 순서·설명은 apps/mobile/BILLING.md

const API = "https://api.revenuecat.com/v2";
const project = process.env.REVENUECAT_PROJECT_ID?.trim();
const key = process.env.REVENUECAT_API_V2_KEY?.trim();
const appType = process.argv[2] ?? "test_store";
if (!project || !key) {
  console.error("REVENUECAT_PROJECT_ID와 REVENUECAT_API_V2_KEY를 apps/web/.env.local에 넣어 주세요");
  process.exit(1);
}

const PREMIUM = { id: "maengo_premium_monthly", title: "맹고 Premium(월)", package: "$rc_monthly", packageName: "Premium 월 구독" };
const PACKS = [10, 30, 50, 100].map((n) => ({ id: `maengo_pack_${n}`, title: `맹고 ${n}개`, package: `pack_${n}`, packageName: `맹고 ${n}개` }));

async function call(method, path, body) {
  const res = await fetch(`${API}/projects/${project}${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** 목록 전부(쪽 넘김) */
async function list(path) {
  const items = [];
  let next = `${path}${path.includes("?") ? "&" : "?"}limit=100`;
  while (next) {
    const page = await call("GET", next);
    items.push(...page.items);
    next = page.next_page ? page.next_page.replace(/^.*\/projects\/[^/]+/, "") : null;
  }
  return items;
}

const apps = await list("/apps");
const app = apps.find((a) => a.type === appType);
if (!app) {
  console.error(`앱 종류 ${appType}가 이 프로젝트에 없어요. 있는 것: ${apps.map((a) => `${a.type}(${a.name})`).join(", ") || "없음"}`);
  process.exit(1);
}
console.log(`앱: ${app.name} (${app.type}, ${app.id})`);

// 1. 상품. 플레이 구독은 '상품ID:기본요금제'(BILLING.md: 기본 요금제 monthly)
const products = await list("/products");
const storeId = (p, sub) => (appType === "play_store" && sub ? `${p.id}:monthly` : p.id);
async function product(p, type, sub) {
  const sid = storeId(p, sub);
  const found = products.find((x) => x.app_id === app.id && x.store_identifier === sid);
  if (found) {
    console.log(`상품 있음: ${sid}`);
    return found;
  }
  const body = { store_identifier: sid, app_id: app.id, type, display_name: p.title, title: p.title };
  if (sub && appType === "test_store") body.subscription = { duration: "P1M" };
  const made = await call("POST", "/products", body);
  console.log(`상품 만듦: ${sid}`);
  return made;
}
const premium = await product(PREMIUM, "subscription", true);
const packs = [];
for (const p of PACKS) packs.push({ ...p, product: await product(p, "consumable", false) });

// 2. 권한 premium ← 구독 상품(묶음은 붙이지 않는다)
const entitlements = await list("/entitlements");
let ent = entitlements.find((e) => e.lookup_key === "premium");
if (!ent) {
  ent = await call("POST", "/entitlements", { lookup_key: "premium", display_name: "Premium" });
  console.log("권한 만듦: premium");
}
try {
  await call("POST", `/entitlements/${ent.id}/actions/attach_products`, { product_ids: [premium.id] });
  console.log("권한 premium ← 구독 상품");
} catch (e) {
  console.log(`권한에 붙이기 건너뜀(이미 붙어 있을 수 있음): ${e.message}`);
}

// 3. 오퍼링 default(Current) ← 패키지 5개
const offerings = await list("/offerings");
let offering = offerings.find((o) => o.lookup_key === "default");
if (!offering) {
  offering = await call("POST", "/offerings", { lookup_key: "default", display_name: "기본" });
  console.log("오퍼링 만듦: default");
}
const existing = await list(`/offerings/${offering.id}/packages`);
const wanted = [{ ...PREMIUM, product: premium }, ...packs];
for (const [i, p] of wanted.entries()) {
  let pkg = existing.find((x) => x.lookup_key === p.package);
  if (!pkg) {
    pkg = await call("POST", `/offerings/${offering.id}/packages`, { lookup_key: p.package, display_name: p.packageName, position: i + 1 });
    console.log(`패키지 만듦: ${p.package}`);
  }
  try {
    await call("POST", `/packages/${pkg.id}/actions/attach_products`, { products: [{ product_id: p.product.id, eligibility_criteria: "all" }] });
    console.log(`패키지 ${p.package} ← ${p.id}`);
  } catch (e) {
    console.log(`패키지에 붙이기 건너뜀(이미 붙어 있을 수 있음): ${e.message}`);
  }
}
await call("POST", `/offerings/${offering.id}`, { is_current: true });
console.log("오퍼링 default를 Current로. 끝");
