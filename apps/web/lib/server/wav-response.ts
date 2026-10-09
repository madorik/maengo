import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';

// Safari는 Range 요청(206)을 지원해야 탐색과 재생이 되므로 직접 처리한다.
export function wavResponse(request: NextRequest, wav: Uint8Array): NextResponse {
  const total = wav.length;
  const headers = { 'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=3600' };
  const range = request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
  if (!range) {
    return new NextResponse(new Blob([wav as Uint8Array<ArrayBuffer>]), { headers: { ...headers, 'content-length': String(total) } });
  }
  let start = range[1] ? Number(range[1]) : total - Number(range[2]);
  let end = range[1] && range[2] ? Number(range[2]) : total - 1;
  start = Math.max(0, start);
  end = Math.min(end, total - 1);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
    return new NextResponse(null, { status: 416, headers: { 'content-range': `bytes */${total}` } });
  }
  return new NextResponse(new Blob([wav.subarray(start, end + 1) as Uint8Array<ArrayBuffer>]), {
    status: 206,
    headers: { ...headers, 'content-length': String(end - start + 1), 'content-range': `bytes ${start}-${end}/${total}` },
  });
}
