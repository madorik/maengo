import 'server-only';
import { GeminiQuotaError } from '@maengo/core/gemini';
import { TtsBusyError } from './limits';
import { NextResponse, type NextRequest } from 'next/server';

/** 음성 파일로 넘긴다. 매번 확인하도록 이 응답은 캐시하지 않는다(서명 URL은 몇 시간 뒤 만료) */
export function redirectToFile(request: NextRequest, url: string): NextResponse {
  return NextResponse.redirect(new URL(url, request.url), { status: 302, headers: { 'cache-control': 'no-store' } });
}

// Safari는 Range 요청(206)을 지원해야 탐색과 재생이 되므로 직접 처리한다(로컬 저장소용).
export function bytesResponse(request: NextRequest, bytes: Uint8Array, contentType: string): NextResponse {
  const total = bytes.length;
  const headers = { 'content-type': contentType, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=31536000, immutable' };
  const range = request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
  if (!range) {
    return new NextResponse(new Blob([bytes as Uint8Array<ArrayBuffer>]), { headers: { ...headers, 'content-length': String(total) } });
  }
  let start = range[1] ? Number(range[1]) : total - Number(range[2]);
  let end = range[1] && range[2] ? Number(range[2]) : total - 1;
  start = Math.max(0, start);
  end = Math.min(end, total - 1);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
    return new NextResponse(null, { status: 416, headers: { 'content-range': `bytes */${total}` } });
  }
  return new NextResponse(new Blob([bytes.subarray(start, end + 1) as Uint8Array<ArrayBuffer>]), {
    status: 206,
    headers: { ...headers, 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${total}` },
  });
}

/** 음성 만들기 실패: 서비스 TTS 한도(503), 그 밖(502) */
export function ttsFailure(e: unknown): NextResponse {
  const busy = e instanceof TtsBusyError || e instanceof GeminiQuotaError;
  console.error('[tts] 실패', busy ? '서비스 한도' : '', String((e as Error)?.message ?? e).slice(0, 300));
  return NextResponse.json({ error: busy ? 'tts_busy' : 'tts_failed' }, { status: busy ? 503 : 502 });
}
