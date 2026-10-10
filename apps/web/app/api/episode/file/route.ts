import { NextResponse, type NextRequest } from "next/server";
import { audioStore, isAudioKey } from "@/lib/server/audio-store";
import { bytesResponse } from "@/lib/server/file-response";
import { currentProfile } from "@/lib/server/session";

// 로컬 저장소(R2 키가 없을 때)의 음성 파일. R2를 쓰면 서명 URL로 바로 받으므로 이 경로는 쓰지 않는다.
export async function GET(request: NextRequest) {
  if (!(await currentProfile())) return new NextResponse(null, { status: 401 });
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (audioStore.kind !== "local" || !isAudioKey(key)) return new NextResponse(null, { status: 404 });
  const bytes = await audioStore.get(key);
  if (!bytes) return new NextResponse(null, { status: 404 });
  return bytesResponse(request, bytes, "audio/mpeg");
}
