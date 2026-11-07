import { NextResponse, type NextRequest } from "next/server";
import { audioStore } from "@/lib/server/audio-store";
import { bytesResponse, redirectToFile } from "@/lib/server/file-response";
import { guestAudioObject } from "@/lib/server/guest-tour";

// 로그인 없이 둘러보기(/try)의 음성 파일. 이미 만든 음성만 내주고 새로 만들지 않는다(lib/server/guest-tour.ts).
// R2면 서명 URL로 넘기고(주소가 몇 시간 뒤 만료돼서 화면에는 이 주소를 둔다), 로컬 저장소면 바로 보낸다(/api/episode/file은 로그인이 필요하다)
export async function GET(request: NextRequest) {
  const object = await guestAudioObject(request.nextUrl.searchParams.get("key") ?? "");
  if (!object) return new NextResponse(null, { status: 404 });
  if (audioStore.kind === "r2") return redirectToFile(request, await audioStore.url(object));
  const bytes = await audioStore.get(object);
  if (!bytes) return new NextResponse(null, { status: 404 });
  return bytesResponse(request, bytes, "audio/mpeg");
}
