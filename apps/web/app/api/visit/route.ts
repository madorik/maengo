import { createHash } from "node:crypto";
import { kstDate } from "@maengo/core/kst";
import { NextResponse, type NextRequest } from "next/server";
import { appInfoOf } from "@/lib/app-client";
import { db } from "@/lib/server/db";
import { SIGNED_IN_HINT } from "@/lib/session-cookie";

// 로그인 안 한 방문자 세기(관리자 요약 탭의 가입 전환율 분모, 2026-11-08). components/GuestVisit.tsx가 하루 한 번 부른다.
// 한 사람 = 기기가 그날만 쓰는 무작위 값(저장소가 막혔으면 IP·User-Agent)을 날짜·비밀값과 함께 바꾼 값(guest_visits.visitor).
// 원래 값(IP 포함)은 남기지 않고, 날이 바뀌면 같은 사람도 다른 값이 된다.
// 로그인한 사람(로그인 힌트·Supabase 쿠키)과 검색 로봇은 세지 않는다. 다른 사이트에서 부른 요청도 버린다. 답은 늘 204.
// 운영 배포(VERCEL_ENV=production)에서만 센다: 로컬·미리보기도 운영 DB를 보므로 시험 방문이 섞이지 않게.

const BOT = /bot|crawl|spider|slurp|scrap|preview|headless|lighthouse|pagespeed|facebookexternalhit|curl|wget|python|axios|node-fetch|go-http/i;
const skip = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return skip();
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return skip();
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return skip();
  if (request.cookies.has(SIGNED_IN_HINT) || request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return skip();

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const date = kstDate();
  const who = id ? `id:${id}` : `ip:${ip}:${ua}`;
  const visitor = createHash("sha256").update(`${process.env.SESSION_SECRET ?? "maengo"}:visit:${date}:${who}`).digest("hex").slice(0, 32);
  const { error } = await db
    .from("guest_visits")
    .upsert({ date, visitor, platform: appInfoOf(ua)?.platform ?? "web" }, { onConflict: "date,visitor", ignoreDuplicates: true });
  if (error) console.error("guest_visits", error.message);
  return skip();
}
