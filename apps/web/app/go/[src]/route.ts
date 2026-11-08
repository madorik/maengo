import { NextResponse, type NextRequest } from "next/server";
import { withBase } from "@/lib/base-path";

// 채널별 짧은 링크(2026-11-08): watalabs.com/maengo/go/<채널> → 둘러보기(/try)에 출처 표시(UTM)를 붙여 보낸다.
// Threads·네이버 블로그·인스타 소개 글과 쇼츠 고정 댓글에 이 링크를 쓰면 GA4 '트래픽 획득'에서 채널마다 나뉘어 보인다.
// 없는 채널 이름이면 출처 없이 둘러보기로. 목록은 맹고-문서/광고.md '채널별 링크'에도 적어 둔다.
const CHANNELS: Record<string, { source: string; medium: string }> = {
  threads: { source: "threads", medium: "social" },
  blog: { source: "naver_blog", medium: "blog" },
  insta: { source: "instagram", medium: "social" },
  shorts: { source: "youtube_shorts", medium: "video" },
  kakao: { source: "kakao", medium: "messenger" },
  linkedin: { source: "linkedin", medium: "social" },
  community: { source: "community", medium: "referral" },
};

export function GET(request: NextRequest, { params }: { params: Promise<{ src: string }> }) {
  return params.then(({ src }) => {
    const ch = CHANNELS[src.toLowerCase()];
    // 라우트 핸들러 리다이렉트는 basePath(/maengo)를 직접 붙인다(lib/base-path.ts)
    const query = ch ? `?utm_source=${ch.source}&utm_medium=${ch.medium}&utm_campaign=organic` : "";
    return NextResponse.redirect(new URL(withBase(`/try${query}`), request.url), 307);
  });
}
