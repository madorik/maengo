import 'server-only';
import { isCategory } from '@maengo/core/categories';
import { childrenOf } from '@maengo/core/topics';
import { isNotPhoto } from '../photo';
import { publicTopicBySlug, PUBLIC_TOPICS } from '../public-topics';
import type { FeedItem, GuestItem } from '../types';
import { getPublicItemEpisode } from './episode';
import { db, must } from './db';
import { publicTopicDigest } from './public-topics';

// 토스 미니앱(앱인토스, intoss://maengo) 자료. 로그인 없이 공개 분야 소식만 내준다(맹고-문서/앱인토스-검토.md).
// 목록은 공개 분야 페이지와 같은 소식·랭킹(publicTopicDigest, 지난 7일 이슈도 순), 상세는 요약 전체 글과 원문 링크.
// 코인은 앱인토스 출시 불가 업종(가상자산 서비스)으로 볼 수 있어 토스판에서 뺀다(2026-11-12).

export const TOSS_TOPIC_IDS = ['ai', 'stock', 'chip-robot', 'dev'] as const;

/** 소식을 들을 수 있는 기간(이보다 오래된 소식은 음성을 새로 만들지 않는다. 목록 기간과 같다) */
const AUDIO_DAYS = 8;
const DAY = 24 * 3600_000;

export interface TossListItem {
  clusterId: number;
  title: string;
  short: string;
  /** 이 소식이 나온 분야 id(ai·stock·chip-robot·dev) */
  field: string;
  sourceLabel: string;
  coverage?: string;
  /** 발행일(없으면 처음 본 날), ISO */
  date: string;
}

export interface TossDetail {
  clusterId: number;
  title: string;
  short: string;
  body: string[];
  sourceLabel: string;
  url: string;
  kind: 'article' | 'video';
  date: string;
  photo: string | null;
}

/** 고른 분야(없으면 전부)의 소식. 분야마다 이슈도 순서를 지키며 번갈아 섞고, 여러 분야에 걸친 소식은 한 번만 */
export async function tossFeed(fields: string[]): Promise<TossListItem[]> {
  const ids = TOSS_TOPIC_IDS.filter((id) => fields.length === 0 || fields.includes(id));
  const lists = await Promise.all(
    ids.map(async (id) => {
      const topic = PUBLIC_TOPICS.find((t) => t.id === id) ?? publicTopicBySlug(id);
      if (!topic) return [];
      const { items } = await publicTopicDigest(topic);
      return items.map((i) => ({ clusterId: i.clusterId, title: i.title, short: i.short, field: id, sourceLabel: i.sourceLabel, coverage: i.coverage, date: i.date }));
    }),
  );
  const out: TossListItem[] = [];
  const seen = new Set<number>();
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const it = l[i];
      if (it && !seen.has(it.clusterId)) {
        seen.add(it.clusterId);
        out.push(it);
      }
    }
  }
  return out;
}

interface DetailRow {
  cluster_id: number;
  title: string;
  short: string;
  body: string[];
  category: string;
  author: string | null;
  published_at: string | null;
  clusters: {
    skip_reason: string | null;
    rep_item_id: number | null;
    first_seen_at: string;
    items: { id: number; canonical_url: string; kind: 'article' | 'video'; author: string | null; image_url: string | null; sources: { name: string; custom: boolean } | null }[];
  };
}

const TOSS_TOPICS_ALL = new Set(TOSS_TOPIC_IDS.flatMap((id) => [id, ...childrenOf(id).map((c) => c.id)]));

/** 소식 하나(공개 출처 글이 있고 걸러지지 않은 것, 토스판 분야에 붙은 것만). 없으면 null */
async function detailRow(clusterId: number): Promise<DetailRow | null> {
  const [row, tags] = await Promise.all([
    db
      .from('summaries')
      .select(
        'cluster_id,title,short,body,category,author,published_at,clusters!inner(skip_reason,rep_item_id,first_seen_at,items!items_cluster_id_fkey(id,canonical_url,kind,author,image_url,sources(name,custom)))',
      )
      .eq('tier', 'basic')
      .eq('cluster_id', clusterId)
      .maybeSingle(),
    db.from('cluster_topics').select('topic_id').eq('cluster_id', clusterId),
  ]);
  const r = must(row, 'toss detail') as unknown as DetailRow | null;
  if (!r || r.clusters.skip_reason) return null;
  const topicIds = (must(tags, 'toss detail topics') as { topic_id: string }[]).map((t) => t.topic_id);
  if (!topicIds.some((t) => TOSS_TOPICS_ALL.has(t))) return null;
  return r;
}

function repOf(r: DetailRow) {
  const open = r.clusters.items.filter((m) => m.sources && !m.sources.custom);
  return open.find((m) => m.id === r.clusters.rep_item_id) ?? open[0] ?? null;
}

export async function tossDetail(clusterId: number): Promise<TossDetail | null> {
  const r = await detailRow(clusterId);
  if (!r) return null;
  const rep = repOf(r);
  if (!rep) return null;
  const real = (u: string | null) => (u && !isNotPhoto(u) ? u : null);
  return {
    clusterId: r.cluster_id,
    title: r.title,
    short: r.short,
    body: r.body,
    sourceLabel: rep.sources!.name,
    url: rep.canonical_url,
    kind: rep.kind,
    date: r.published_at ?? r.clusters.first_seen_at,
    photo: rep.kind === 'article' ? (real(rep.image_url) ?? r.clusters.items.map((m) => real(m.image_url)).find(Boolean) ?? null) : null,
  };
}

/**
 * 음성을 만들 소식(FeedItem 모양). 최근 소식만(오래된 소식을 하나씩 불러 음성을 잔뜩 만들지 않게). 없으면 null.
 * 대본은 제목·한 줄 요약·전체 글로 만들어(templateScript) 로그인한 사람이 듣는 같은 소식과 같은 음성 키가 된다
 */
export async function tossAudioItem(clusterId: number): Promise<FeedItem | null> {
  const r = await detailRow(clusterId);
  if (!r || Date.now() - Date.parse(r.clusters.first_seen_at) > AUDIO_DAYS * DAY) return null;
  const rep = repOf(r);
  if (!rep) return null;
  return {
    rank: 1,
    clusterId: r.cluster_id,
    token: '',
    feedDate: '',
    title: r.title,
    kind: rep.kind,
    category: isCategory(r.category) ? r.category : 'etc',
    sourceLabel: rep.sources!.name,
    author: r.author ?? rep.author ?? rep.sources!.name,
    publishedLabel: '',
    url: rep.canonical_url,
    thumbnail: null,
    short: r.short,
    body: r.body,
    topicId: '',
    topicName: '',
    why: '',
  };
}

/** 토스 미니앱은 다른 도메인에서 부른다. 쿠키 없이 읽기만 해서 모두에게 연다 */
export const TOSS_CORS = { 'access-control-allow-origin': '*' } as const;

/** 토스판 첫 화면(둘러보기와 같은 화면)에 보여 줄 소식 수 */
const TOUR_SIZE = 10;

/**
 * 토스 미니앱 첫 화면 소식(로그인 없이 둘러보기 /try와 같은 GuestItem 모양, components/try/GuestTour.tsx가 그린다).
 * 토스판 분야 소식을 이슈도 순서로 번갈아 고른 앞 10개. 음성 시각표는 이미 만든 음성이면 실제 값, 아직이면 어림값이고
 * missing은 음성이 아직 없는 소식(부른 쪽이 응답 뒤에 미리 만든다)
 */
export async function tossTour(): Promise<{ items: GuestItem[]; missing: FeedItem[] }> {
  const list = (await tossFeed([])).slice(0, TOUR_SIZE * 2);
  const out: GuestItem[] = [];
  const missing: FeedItem[] = [];
  const built = await Promise.all(
    list.map(async (l) => {
      const [detail, feedItem] = await Promise.all([tossDetail(l.clusterId), tossAudioItem(l.clusterId)]);
      if (!detail || !feedItem) return null;
      const ep = await getPublicItemEpisode(feedItem, 'f', { generate: false });
      const lines = ep.chapters[0]?.lines ?? [];
      if (!lines.length) return null;
      return { detail, feedItem, ready: !!ep.objectKey, durationMs: ep.durationMs, lines };
    }),
  );
  for (const b of built) {
    if (!b || out.length >= TOUR_SIZE) continue;
    if (!b.ready) missing.push(b.feedItem);
    out.push({
      clusterId: b.detail.clusterId,
      title: b.detail.title,
      short: b.detail.short,
      category: b.feedItem.category,
      kind: b.detail.kind,
      sourceLabel: b.detail.sourceLabel,
      author: b.feedItem.author,
      url: b.detail.url,
      audioKey: `toss-${b.detail.clusterId}`,
      durationMs: b.durationMs,
      lines: b.lines.map(({ text, startMs, endMs, para }) => ({ text, startMs, endMs, ...(para !== undefined ? { para } : {}) })),
      photo: b.detail.photo,
    });
  }
  return { items: out, missing };
}

/** 음성이 아직 없는 소식의 음성을 만들어 둔다(응답 뒤에, 소식마다 한 번만. 실패는 다음 요청이 다시 해 본다) */
export async function warmTossAudio(items: FeedItem[]): Promise<void> {
  for (const item of items) {
    try {
      await getPublicItemEpisode(item, 'f', { generate: true });
    } catch (e) {
      console.warn(`[toss] #${item.clusterId} 음성 미리 만들기 실패`, String((e as Error)?.message ?? e).slice(0, 160));
    }
  }
}
