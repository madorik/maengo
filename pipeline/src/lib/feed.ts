import { XMLParser } from 'fast-xml-parser';
import { clip, htmlToText } from './text';

// RSS 2.0·Atom·유튜브 채널 피드를 한 모양으로 읽는다.
// 인기 신호도 읽는다: 유튜브 조회수(media:statistics views), 해커 뉴스 점수(hnrss 설명의 "Points: N").
// 유튜브 쇼츠는 채널 RSS의 링크가 /shorts/로 온다(isShort). 요약할 내용이 거의 없어서 수집하지 않는다.

export interface FeedEntry {
  url: string;
  title: string;
  author: string | null;
  publishedAt: Date | null;
  excerpt: string;
  /** 글 대표 이미지(RSS에 붙어 온 것). 상세 화면 사진. 영상·없으면 null */
  image: string | null;
  videoId: string | null;
  views: number | null;
  hnPoints: number | null;
  isShort: boolean;
}

function count(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** hnrss 설명(HTML)의 "Points: 260". 해커 뉴스 글이 아니면 null */
function hnPointsOf(desc: string): number | null {
  if (!desc.includes('news.ycombinator.com/item')) return null;
  const m = /Points:\s*(\d+)/.exec(desc);
  return m ? count(m[1]) : null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: false,
  isArray: (name) => ['item', 'entry', 'link', 'author', 'category'].includes(name),
});

type Node = unknown;

function text(n: Node): string {
  if (n == null) return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return text(n[0]);
  if (typeof n === 'object') {
    const o = n as Record<string, Node>;
    if ('#text' in o) return text(o['#text']);
    if ('name' in o) return text(o.name);
  }
  return '';
}

/** 시간대가 없는 날짜(국내 매체 CMS)는 출처 언어로 짐작한다. 한국 매체면 KST */
export function parseDate(raw: string, lang: 'ko' | 'en'): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const hasZone = /([+-]\d{2}:?\d{2}|Z|GMT|UTC|[A-Z]{3})\s*$/i.test(s);
  let d: Date;
  if (!hasZone && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) {
    d = new Date(`${s.replace(' ', 'T')}${lang === 'ko' ? '+09:00' : 'Z'}`);
  } else {
    d = new Date(s);
  }
  return Number.isNaN(d.getTime()) ? null : d;
}

function atomLink(links: Node): string {
  const arr = (Array.isArray(links) ? links : [links]) as Record<string, string>[];
  const alt = arr.find((l) => l && typeof l === 'object' && (!l['@_rel'] || l['@_rel'] === 'alternate')) ?? arr[0];
  if (!alt) return '';
  return typeof alt === 'string' ? alt : alt['@_href'] ?? text(alt);
}

/** 피드(채널) 제목. 내 관심 링크의 출처 이름으로 쓴다. 없으면 '' */
export function feedTitle(xml: string): string {
  const doc = parser.parse(xml) as Record<string, any>;
  return htmlToText(text(doc.rss?.channel?.title) || text(doc['rdf:RDF']?.channel?.title) || text(doc.feed?.title)).trim();
}

/** RSS 2.0·RDF·Atom 문서인지(항목이 없어도). 피드가 아닌 HTML은 false */
export function isFeedXml(xml: string): boolean {
  try {
    const doc = parser.parse(xml) as Record<string, any>;
    return !!(doc.rss?.channel || doc['rdf:RDF'] || doc.feed);
  } catch {
    return false;
  }
}

/** 글 주소는 http(s)만 받는다. javascript:·data: 같은 주소가 원문 링크로 나가지 않게(2026-10-17) */
export function isWebUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw.trim());
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * 대표 이미지 주소를 다듬는다(2026-11-10, 상세 화면 사진). http는 https로 올리고(https 화면에서 막히지 않게),
 * 추적 픽셀처럼 보이는 건 뺀다. 쓸 수 없으면 null
 */
export function cleanImageUrl(raw: string | null | undefined, base?: string): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/&amp;/g, '&');
  if (s.startsWith('//')) s = `https:${s}`;
  if (base && !/^https?:/i.test(s)) {
    try {
      s = new URL(s, base).toString();
    } catch {
      return null;
    }
  }
  if (/^http:\/\//i.test(s)) s = `https://${s.slice(7)}`;
  if (!isWebUrl(s) || s.length > 1000) return null;
  if (/pixel|beacon|feedburner|doubleclick|\/1x1|spacer|blank\.gif|\/stats?\//i.test(s)) return null;
  return s;
}

type Attrs = Record<string, string | undefined>;

function attrUrls(n: Node, ok: (o: Attrs) => boolean = () => true): string[] {
  const arr = (Array.isArray(n) ? n : n ? [n] : []) as Attrs[];
  return arr.filter((o) => o && typeof o === 'object' && o['@_url'] && ok(o)).map((o) => o['@_url']!);
}

const isImageMedia = (o: Attrs) => {
  const medium = o['@_medium'];
  const type = o['@_type'] ?? '';
  return medium === 'image' || type.startsWith('image/') || (!medium && !type && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(o['@_url'] ?? ''));
};

/** RSS·Atom 항목의 이미지: media:content(이미지) → media:thumbnail → enclosure(이미지) → 본문 첫 img */
function imageOf(it: any, html: string): string | null {
  const group = it['media:group'];
  const candidates = [
    ...attrUrls(it['media:content'], isImageMedia),
    ...attrUrls(group?.['media:content'], isImageMedia),
    ...attrUrls(it['media:thumbnail']),
    ...attrUrls(group?.['media:thumbnail']),
    ...attrUrls(it.enclosure, (o) => (o['@_type'] ?? '').startsWith('image/')),
    /<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1] ?? '',
  ];
  for (const c of candidates) {
    const url = cleanImageUrl(c);
    if (url) return url;
  }
  return null;
}

export function parseFeed(xml: string, lang: 'ko' | 'en'): FeedEntry[] {
  const doc = parser.parse(xml) as Record<string, any>;
  const out: FeedEntry[] = [];
  if (doc.rss?.channel || doc['rdf:RDF']) {
    const items: any[] = doc.rss?.channel?.item ?? doc['rdf:RDF']?.item ?? [];
    for (const it of items) {
      const url = text(it.link) || text(it.guid);
      if (!isWebUrl(url)) continue;
      const desc = text(it.description) || text(it['content:encoded']);
      out.push({
        url: url.trim(),
        title: htmlToText(text(it.title)),
        author: text(it['dc:creator']) || text(it.author) || null,
        publishedAt: parseDate(text(it.pubDate) || text(it['dc:date']), lang),
        excerpt: clip(htmlToText(desc), 600),
        image: imageOf(it, `${text(it['content:encoded'])} ${text(it.description)}`),
        videoId: null,
        views: null,
        hnPoints: hnPointsOf(desc),
        isShort: false,
      });
    }
  } else if (doc.feed) {
    for (const e of (doc.feed.entry ?? []) as any[]) {
      const videoId = text(e['yt:videoId']) || null;
      const link = atomLink(e.link);
      const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : link;
      if (!isWebUrl(url)) continue;
      const group = e['media:group'];
      const desc = videoId ? text(group?.['media:description']) : text(e.summary) || text(e.content);
      out.push({
        url: url.trim(),
        title: htmlToText(text(e.title)),
        author: text(e.author) || null,
        publishedAt: parseDate(text(e.published) || text(e.updated), lang),
        excerpt: clip(htmlToText(desc), 600),
        // 영상 썸네일은 영상 ID로 만든다(웹 youtubeThumbnail)
        image: videoId ? null : imageOf(e, desc),
        videoId,
        views: videoId ? count(group?.['media:community']?.['media:statistics']?.['@_views']) : null,
        hnPoints: null,
        isShort: !!videoId && link.includes('/shorts/'),
      });
    }
  }
  return out.filter((e) => e.title);
}

/** 내 관심 링크 출처는 한 번에 최신 이만큼만(글이 쏟아지는 집계 사이트를 넣어도 임베딩 비용이 새지 않게) */
export const LINK_MAX_PER_FETCH = 20;

/** 창(since) 안의 글. 날짜 없는 피드는 맨 앞 3개만 본다(처음 볼 때 옛 글이 한꺼번에 들어오지 않게). 쇼츠는 뺀다. 최신순 */
export function freshEntries(entries: FeedEntry[], since: number, cap = Infinity): FeedEntry[] {
  let undated = 0;
  return entries
    .filter((e) => !e.isShort)
    .filter((e) => (e.publishedAt ? e.publishedAt.getTime() >= since : undated++ < 3))
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, cap);
}

/** 피드에서 본 가장 최근 글의 발행 시각(sources.last_item_at). 날짜가 하나도 없으면 null */
export function latestOf(entries: FeedEntry[]): string | null {
  const t = Math.max(...entries.map((e) => e.publishedAt?.getTime() ?? 0));
  return t > 0 ? new Date(t).toISOString() : null;
}
