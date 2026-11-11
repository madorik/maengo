import { NextResponse, type NextRequest } from "next/server";
import { mobileOsOf } from "@/lib/app-install";
import { withBase } from "@/lib/base-path";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/site";

// 앱 받기(2026-11-11): watalabs.com/maengo/go/app?from=<자리> → 기기를 보고 App Store·Google Play로 보낸다(lib/app-install.ts).
// 휴대폰 웹의 띠·알림 안내·듣기 안내와 PC 화면의 QR이 이 주소를 쓴다. PC로 열면 스토어 버튼이 있는 소개 페이지로.
// Play에는 referrer로 출처를 넘겨 Play Console 획득 보고서에서 자리마다 나뉘어 보이게 한다. 로그(Vercel)에도 남긴다.
// 이 고정 경로가 /go/[src](채널 링크)보다 먼저 잡힌다.
export function GET(request: NextRequest) {
  const from = (request.nextUrl.searchParams.get("from") ?? "").replace(/[^\w-]/g, "").slice(0, 40) || "direct";
  const os = mobileOsOf(request.headers.get("user-agent"));
  console.log("go/app", JSON.stringify({ from, os: os ?? "pc" }));
  // 소개 페이지는 도메인 없는 상대 주소로 보낸다(/go/[src]와 같은 까닭: watalabs.com이 maengo.vercel.app으로 넘겨준다)
  const location =
    os === "ios"
      ? APP_STORE_URL
      : os === "android" && PLAY_STORE_URL
        ? `${PLAY_STORE_URL}&referrer=${encodeURIComponent(`utm_source=maengo_web&utm_medium=${from}`)}`
        : withBase("/");
  return new NextResponse(null, { status: 307, headers: { location, "cache-control": "no-store" } });
}
