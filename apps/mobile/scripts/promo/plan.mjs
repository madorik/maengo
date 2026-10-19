// 데모 계정 플랜 바꾸기(홍보 영상 촬영용). node plan.mjs plus|free
// apps/web/.env.local의 서비스 키로 set_plan(회원, 플랜, 만료, 이유)을 부른다. plus는 내일까지, free는 plus일 때만.
import { readFileSync } from "node:fs";

const envText = readFileSync(new URL("../../../web/.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const user = env.DEMO_USER_ID;
if (!url || !key || !user) throw new Error("env missing: " + JSON.stringify({ url: !!url, key: !!key, user: !!user }));

const plan = process.argv[2];
if (!["plus", "free"].includes(plan)) throw new Error("plan: plus|free");
const body = plan === "plus"
  ? { p_user: user, p_plan: "plus", p_until: new Date(Date.now() + 36 * 3600 * 1000).toISOString(), p_reason: "promo_video" }
  : { p_user: user, p_plan: "free", p_until: null, p_reason: "promo_video_done", p_only_if: "plus" };

const res = await fetch(`${url}/rest/v1/rpc/set_plan`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log(plan, res.status, await res.text());
