import 'server-only';
import { NextResponse } from 'next/server';
import { withBase } from '../base-path';

/**
 * 라우트 핸들러에서 맹고 안의 다른 화면으로 보낸다(path는 basePath를 뺀 앱 경로, 예: "/login").
 * watalabs.com이 맹고를 프록시하므로 request.url의 호스트는 maengo.vercel.app이다. 그 호스트로 보내지 않도록
 * 상대 주소(Location: /maengo/login)로 보내 브라우저가 지금 주소창의 도메인에서 이어 가게 한다.
 */
export function redirectInApp(path: string, init?: { status?: number; headers?: Record<string, string> }): NextResponse {
  return new NextResponse(null, { status: init?.status ?? 307, headers: { ...init?.headers, location: withBase(path) } });
}
