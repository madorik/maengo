// 같은 글이 다른 주소로 두 번 들어오지 않게 추적용 파라미터를 걷어 낸다. 주소 자체(호스트·경로)는 바꾸지 않는다.

const TRACKING = /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|ref_src|ref|igshid|spm)$/i;

export function youtubeIdOf(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1]! : null;
}

export function canonicalUrl(raw: string): string {
  const yt = youtubeIdOf(raw);
  if (yt) return `https://www.youtube.com/watch?v=${yt}`;
  const u = new URL(raw.trim());
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  for (const key of [...u.searchParams.keys()]) {
    const value = u.searchParams.get(key) ?? '';
    if (TRACKING.test(key) || (key === 'source' && /^rss/i.test(value))) u.searchParams.delete(key);
  }
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}
