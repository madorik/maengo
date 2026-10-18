// 내 관심 링크(2026-10-15 사용자 결정): Premium이 블로그·사이트의 RSS 주소를 넣으면 그곳의 새 글을 소식으로 받는다.
// 출처(sources.id)마다 토픽 's-<id>'를 두고 구독은 user_topics에 둔다. 그래서 랭킹·피드백·지급은 관심사와 같은 길을 탄다.
// 여기는 순수 함수만: 토픽 id, 주소 검사(막는 곳·사설 주소), 플랫폼별 피드 주소 규칙, HTML에서 피드 링크 찾기.
// 실제로 가져와 확인하는 건 pipeline/src/links.ts(resolveLink). 유튜브는 받지 않는다(영상 요약 비용).

const LINK_TOPIC = /^s-\d+$/;

export function linkTopicId(sourceId: number): string {
  return `s-${sourceId}`;
}

export function isLinkTopicId(id: string): boolean {
  return LINK_TOPIC.test(id);
}

/** 's-12' → 12. 링크 토픽이 아니면 null */
export function linkSourceId(topicId: string): number | null {
  return isLinkTopicId(topicId) ? Number(topicId.slice(2)) : null;
}

/**
 * 소식을 고를 때 쓰는 관심사 가중치: 내 관심 링크는 플랜 개수(linkLimit)까지만, 칸 번호가 앞인 것부터 남긴다.
 * Premium·체험이 끝나면(Free 0개) 넣어 둔 링크는 설정에 남지만 링크 글은 더 고르지 않는다. 링크가 아닌 관심사는 그대로
 */
export function rankingWeights(rows: { topic_id: string; weight: number; slot?: number | null }[], linkLimit: number): Record<string, number> {
  const links = rows
    .filter((r) => isLinkTopicId(r.topic_id))
    .sort((a, b) => (a.slot ?? Infinity) - (b.slot ?? Infinity) || a.topic_id.localeCompare(b.topic_id));
  const kept = new Set(links.slice(0, Math.max(0, linkLimit)).map((r) => r.topic_id));
  return Object.fromEntries(rows.filter((r) => !isLinkTopicId(r.topic_id) || kept.has(r.topic_id)).map((r) => [r.topic_id, r.weight]));
}

/** 못 넣는 까닭. 화면 문구는 LINK_ERROR_MESSAGE */
export type LinkError = 'invalid' | 'http' | 'youtube' | 'blocked' | 'private' | 'unsafe' | 'unreachable' | 'nofeed' | 'empty';

export const LINK_ERROR_MESSAGE: Record<LinkError, string> = {
  invalid: '주소가 아니에요. https://로 시작하는 주소를 넣어 주세요.',
  http: 'http 주소는 받을 수 없어요. https://로 시작하는 주소를 넣어 주세요.',
  youtube: '유튜브는 받을 수 없어요.',
  blocked: '이 사이트는 받을 수 없어요.',
  private: '이 주소는 받을 수 없어요.',
  unsafe: '도박·불법·사기 관련 사이트는 넣을 수 없어요.',
  unreachable: '이 사이트는 가져올 수 없어요.',
  nofeed: '이 사이트에서 새 글 목록을 찾지 못했어요.',
  empty: '이 피드에는 글이 없어요.',
};

/** http://로 적은 주소. 내 관심 링크는 https만 받는다(2026-10-17 사용자 결정). 까닭을 따로 알려 주려고 normalizeLinkInput 전에 본다 */
export function isHttpInput(raw: string): boolean {
  return /^http:\/\//i.test(raw.trim());
}

/** 사용자가 적은 주소를 URL로. 프로토콜이 없으면 https를 붙인다. https가 아니면(http 포함) null */
export function normalizeLinkInput(raw: string): URL | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    u.hash = '';
    return u;
  } catch {
    return null;
  }
}

const YOUTUBE = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i;
// RSS를 주지 않거나 로그인 뒤에만 보이는 곳. 주소만 보고 미리 알려 준다
const NO_FEED = /(^|\.)(brunch\.co\.kr|x\.com|twitter\.com|instagram\.com|threads\.net|facebook\.com|tiktok\.com|linkedin\.com|cafe\.naver\.com|cafe\.daum\.net|band\.us)$/i;

/** 주소만 보고 막는 곳: 유튜브(youtube), RSS가 없는 SNS·브런치(blocked). 아니면 null */
export function blockedHost(hostname: string): 'youtube' | 'blocked' | null {
  const host = hostname.toLowerCase();
  if (YOUTUBE.test(host)) return 'youtube';
  if (NO_FEED.test(host)) return 'blocked';
  return null;
}

/** 서버가 가져오면 안 되는 주소(사설망·로컬). 리다이렉트로 옮겨 간 주소도 같은 검사를 한다 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return true;
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  if (host.includes(':')) {
    // IPv6: 루프백·링크 로컬·고유 로컬·IPv4 매핑
    return host === '::1' || host === '::' || /^fe[89ab]/i.test(host) || /^f[cd]/i.test(host) || host.startsWith('::ffff:');
  }
  return false;
}

/** 호스트가 IP 주소 그대로인지(IPv4·IPv6). URL 파서가 16진·정수 표기(0x7f.1, 2130706433)도 점 네 개로 바꿔 둔다 */
export function isIpHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '');
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
}

/**
 * 주소 모양만 보고 받지 않는 링크(2026-10-17): 사설·내부 이름, IP 주소 그대로, 기본(443)이 아닌 포트, 주소 안의 아이디·비밀번호.
 * 실제로 연결할 IP는 서버가 열 때 다시 본다(pipeline lib/safe-http.ts)
 */
export function isUnsafeLinkUrl(u: URL): boolean {
  return isPrivateHost(u.hostname) || isIpHost(u.hostname) || u.port !== '' || u.username !== '' || u.password !== '';
}

/** 주소가 이미 피드처럼 보이는지(.xml·.rss·.atom, /feed, /rss) */
export function looksLikeFeedUrl(u: URL): boolean {
  const path = u.pathname.toLowerCase().replace(/\/+$/, '');
  return /\.(xml|rss|atom)$/.test(path) || /(^|\/)(feed|rss|atom|feeds)(\/[^/]*)?$/.test(path) || u.searchParams.has('feed') || /\/feed\//.test(path);
}

/**
 * 플랫폼마다 정해진 피드 주소. 페이지를 열어 보지 않아도 되는 곳들(티스토리·벨로그·네이버 블로그·미디엄·서브스택·깃허브·레딧).
 * 모르는 곳은 빈 배열(페이지에서 <link rel="alternate">를 찾는다)
 */
export function platformFeedUrls(u: URL): string[] {
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  const out: string[] = [];
  if (host.endsWith('.tistory.com')) out.push(`https://${host}/rss`);
  else if (host === 'velog.io' && parts[0]?.startsWith('@')) out.push(`https://v2.velog.io/rss/${parts[0]}`);
  else if ((host === 'blog.naver.com' || host === 'm.blog.naver.com') && parts[0]) out.push(`https://rss.blog.naver.com/${parts[0]}.xml`);
  else if (host === 'medium.com' && parts[0]) out.push(`https://medium.com/feed/${parts[0]}`);
  else if (host.endsWith('.medium.com') && host !== 'medium.com') out.push(`https://${host}/feed`);
  else if (host.endsWith('.substack.com')) out.push(`https://${host}/feed`);
  else if (host === 'github.com' && parts.length >= 2) out.push(`https://github.com/${parts[0]}/${parts[1]}/releases.atom`);
  else if ((host === 'reddit.com' || host === 'old.reddit.com') && parts[0] === 'r' && parts[1]) out.push(`https://www.reddit.com/r/${parts[1]}/.rss`);
  return out;
}

/** 페이지에서 흔히 쓰는 피드 경로. 사이트 루트와 넣은 경로 아래에서 차례로 본다 */
export const COMMON_FEED_PATHS = ['feed', 'rss', 'rss.xml', 'feed.xml', 'atom.xml', 'index.xml'];

const LINK_TAG = /<link\b[^>]*>/gi;
const ATTR = /([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
/** 본문 링크 중 피드처럼 보이는 주소(.rss·.atom·.xml로 끝나거나 /feed·/rss 경로). 사이트맵·검색 설명 파일은 뺀다 */
const FEEDISH_HREF = /(\.(rss|atom|xml)|\/(feed|rss|atom))\/?(\?[^#]*)?(#.*)?$/i;
const NOT_FEED = /sitemap|opensearch|manifest|\.xsl/i;
/** 본문 링크 후보 상한(본문에 .xml 링크가 널려 있어도 몇 개만 열어 본다) */
const MAX_BODY_LINKS = 4;

/**
 * HTML에서 피드 주소 후보. 먼저 <link rel="alternate" type="application/rss+xml|atom+xml">, 그다음 본문의 피드처럼 보이는 a href
 * (네이버 D2처럼 link 태그 없이 본문에 d2.atom 링크만 둔 곳). 상대 주소는 base로 푼다
 */
export function feedLinksInHtml(html: string, base: string): string[] {
  const out: string[] = [];
  const push = (raw: string) => {
    try {
      const href = new URL(raw, base).toString();
      if (!out.includes(href)) out.push(href);
    } catch {
      /* 잘못된 href는 넘긴다 */
    }
  };
  const head = html.slice(0, 200_000);
  for (const tag of head.match(LINK_TAG) ?? []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(ATTR)) attrs[m[1]!.toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? '').trim();
    const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/);
    const type = (attrs.type ?? '').toLowerCase();
    if (!rel.includes('alternate') || !/application\/(rss|atom|rdf)\+xml|text\/xml|application\/xml/.test(type) || !attrs.href) continue;
    push(attrs.href);
  }
  const fromLinkTags = out.length;
  for (const m of head.matchAll(HREF)) {
    if (out.length - fromLinkTags >= MAX_BODY_LINKS) break;
    const raw = (m[1] ?? m[2] ?? '').trim();
    if (!raw || NOT_FEED.test(raw) || !FEEDISH_HREF.test(raw)) continue;
    push(raw);
  }
  return out;
}

/** sources.url로 쓸 피드 주소. 호스트는 소문자, 해시·끝 슬래시는 뺀다(같은 피드가 두 행이 되지 않게) */
export function feedUrlKey(url: string): string {
  const u = new URL(url);
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

/** 한 글자라도 한글이면 한국어 출처로 본다(시간대 없는 날짜를 KST로 읽는다) */
export function guessLang(texts: string[]): 'ko' | 'en' {
  return texts.some((t) => /[가-힣]/.test(t)) ? 'ko' : 'en';
}
