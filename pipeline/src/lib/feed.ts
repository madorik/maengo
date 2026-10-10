import { XMLParser } from 'fast-xml-parser';
import { clip, htmlToText } from './text';

// RSS 2.0·Atom·유튜브 채널 피드를 한 모양으로 읽는다.
// 인기 신호도 읽는다: 유튜브 조회수(media:statistics views), 해커 뉴스 점수(hnrss 설명의 "Points: N").

export interface FeedEntry {
  url: string;
  title: string;
  author: string | null;
  publishedAt: Date | null;
  excerpt: string;
  videoId: string | null;
  views: number | null;
  hnPoints: number | null;
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

export function parseFeed(xml: string, lang: 'ko' | 'en'): FeedEntry[] {
  const doc = parser.parse(xml) as Record<string, any>;
  const out: FeedEntry[] = [];
  if (doc.rss?.channel || doc['rdf:RDF']) {
    const items: any[] = doc.rss?.channel?.item ?? doc['rdf:RDF']?.item ?? [];
    for (const it of items) {
      const url = text(it.link) || text(it.guid);
      if (!url) continue;
      const desc = text(it.description) || text(it['content:encoded']);
      out.push({
        url: url.trim(),
        title: htmlToText(text(it.title)),
        author: text(it['dc:creator']) || text(it.author) || null,
        publishedAt: parseDate(text(it.pubDate) || text(it['dc:date']), lang),
        excerpt: clip(htmlToText(desc), 600),
        videoId: null,
        views: null,
        hnPoints: hnPointsOf(desc),
      });
    }
  } else if (doc.feed) {
    for (const e of (doc.feed.entry ?? []) as any[]) {
      const videoId = text(e['yt:videoId']) || null;
      const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : atomLink(e.link);
      if (!url) continue;
      const group = e['media:group'];
      const desc = videoId ? text(group?.['media:description']) : text(e.summary) || text(e.content);
      out.push({
        url: url.trim(),
        title: htmlToText(text(e.title)),
        author: text(e.author) || null,
        publishedAt: parseDate(text(e.published) || text(e.updated), lang),
        excerpt: clip(htmlToText(desc), 600),
        videoId,
        views: videoId ? count(group?.['media:community']?.['media:statistics']?.['@_views']) : null,
        hnPoints: null,
      });
    }
  }
  return out.filter((e) => e.title);
}
