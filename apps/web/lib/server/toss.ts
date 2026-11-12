import 'server-only';
import { unstable_cache } from 'next/cache';
import { GEMINI_MODELS } from '@maengo/core/ai';
import type { CategoryId } from '@maengo/core/categories';
import { MIN_RELEVANCE, type Impact } from '@maengo/core/feed';
import { geminiChatJson } from '@maengo/core/gemini';
import { kstDate } from '@maengo/core/kst';
import {
  cleanDigest,
  DIGEST_MAX_ITEMS,
  DIGEST_SCHEMA,
  DIGEST_SYSTEM,
  digestPrompt,
  lastCompleted,
  pickDigestItems,
  REPORT_MIN_ITEMS,
  reportRange,
  reportTitle,
  type DigestItem,
  type ReportDigest,
} from '@maengo/core/report';
import { sectionOf } from '@maengo/core/sections';
import { logUsage } from './ai';
import { publicInsight, type BriefingInsight } from './briefing-insight';
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

// ---- 오늘의 흐름·주간 리포트(토스 공통판, 2026-11-12 사용자 '인사이트, 주간 리포트 넣어야 해') ----
// 토스판은 로그인이 없어 회원 맞춤이 아니라 토스판 소식으로 만든 한 편을 모두가 같이 본다. 같은 소식 묶음·같은 주는 한 번만 만든다(데이터 캐시)

/** 오늘의 흐름: 지금 첫 화면 소식 10개를 엮는다. 소식 묶음이 같으면 하루 동안 다시 만들지 않는다. 못 만들면 던져서 캐시에 남기지 않는다 */
const insightOf = unstable_cache(
  async (ids: string): Promise<BriefingInsight> => {
    const items = (await Promise.all(ids.split(',').map((id) => tossAudioItem(Number(id))))).filter((i): i is FeedItem => !!i);
    const made = await publicInsight(items.map((i) => ({ ...i, section: sectionOf({ category: i.category }) })));
    if (!made) throw new Error('토스 오늘의 흐름을 못 만듦');
    return made;
  },
  ['toss-insight-v1'],
  { revalidate: 86400 },
);

/** 첫 화면 소식과 그 소식으로 엮은 오늘의 흐름. 화면은 ids가 자기 목록과 같을 때만 쓴다(목록이 바뀌는 사이) */
export async function tossInsight(): Promise<{ ids: number[]; insight: BriefingInsight } | null> {
  const { items } = await tossTour();
  if (items.length < 2) return null;
  const ids = items.map((i) => i.clusterId);
  try {
    return { ids, insight: await insightOf(ids.join(',')) };
  } catch (e) {
    console.warn('[toss] 오늘의 흐름 실패', String((e as Error)?.message ?? e).slice(0, 160));
    return null;
  }
}

export interface TossReport {
  start: string;
  title: string;
  range: string;
  digest: ReportDigest;
  /** 이 주 토스판 분야 소식 수 */
  total: number;
  /** 분야마다 소식 수(많은 순) */
  groups: { id: string; name: string; count: number }[];
  /** 정리가 가리키는 소식(제목·분야·원문 주소). 누르면 원문을 기기 브라우저로 연다 */
  items: Record<string, { title: string; category: CategoryId; url: string }>;
}

interface WeekRow {
  cluster_id: number;
  title: string;
  short: string;
  category: string;
  impact: Impact | null;
  clusters: {
    rep_item_id: number | null;
    cluster_topics: { topic_id: string; relevance: number }[];
    items: { id: number; canonical_url: string; sources: { name: string; custom: boolean } | null }[];
  };
}

/** 세부 관심사 → 토스판 분야 id */
const fieldOfTopic = (topicId: string) => TOSS_TOPIC_IDS.find((id) => id === topicId || childrenOf(id).some((c) => c.id === topicId)) ?? null;

/** 지난주(월~일) 토스판 분야 소식으로 만든 주간 리포트. 주마다 한 번 Gemini로(약 ₩4). 못 만들면 던진다 */
const reportOf = unstable_cache(
  async (start: string): Promise<TossReport> => {
    const from = new Date(`${start}T00:00:00+09:00`).toISOString();
    const to = new Date(Date.parse(from) + 7 * DAY).toISOString();
    const rows = must(
      await db
        .from('summaries')
        .select(
          'cluster_id,title,short,category,impact,clusters!inner(rep_item_id,first_seen_at,skip_reason,cluster_topics!inner(topic_id,relevance),items!items_cluster_id_fkey!inner(id,canonical_url,sources!inner(name,custom)))',
        )
        .eq('tier', 'basic')
        .is('clusters.skip_reason', null)
        .gte('clusters.first_seen_at', from)
        .lt('clusters.first_seen_at', to)
        .in('clusters.cluster_topics.topic_id', [...TOSS_TOPICS_ALL])
        .gte('clusters.cluster_topics.relevance', MIN_RELEVANCE)
        .eq('clusters.items.sources.custom', false)
        .order('cluster_id', { ascending: true })
        .limit(600),
      'toss week',
    ) as unknown as WeekRow[];
    const name = (id: string) => PUBLIC_TOPICS.find((t) => t.id === id)?.name ?? id;
    const digestItems: (DigestItem & { field: string })[] = [];
    const items: TossReport['items'] = {};
    for (const r of rows) {
      const top = [...r.clusters.cluster_topics].sort((a, b) => b.relevance - a.relevance).map((t) => fieldOfTopic(t.topic_id)).find(Boolean);
      const rep = r.clusters.items.find((m) => m.id === r.clusters.rep_item_id) ?? r.clusters.items[0];
      if (!top || !rep) continue;
      digestItems.push({ id: r.cluster_id, group: name(top), field: top, title: r.title, short: r.short, consumed: false, impact: r.impact });
      items[r.cluster_id] = { title: r.title, category: isCategory(r.category) ? r.category : 'etc', url: rep.canonical_url };
    }
    if (digestItems.length < REPORT_MIN_ITEMS) throw new Error(`토스 주간 리포트 소식이 적음(${digestItems.length})`);
    const counts = new Map<string, number>();
    for (const i of digestItems) counts.set(i.field, (counts.get(i.field) ?? 0) + 1);
    const groups = [...counts].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, name: name(id), count }));
    const groupNames = groups.map((g) => g.name);
    const picked = pickDigestItems(digestItems, groupNames, DIGEST_MAX_ITEMS.week);
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY 없음');
    const raw = await geminiChatJson<unknown>({
      apiKey,
      model: GEMINI_MODELS.report,
      kind: 'report',
      system: `${DIGEST_SYSTEM}\n\n${digestPrompt(`${reportTitle('week', start)} (${reportRange('week', start)})`, groupNames, picked, 90, [])}`,
      turns: [{ role: 'user', text: '이 기간 리포트 정리' }],
      schema: DIGEST_SCHEMA,
      timeoutMs: 45_000,
      onUsage: logUsage,
    });
    const digest = cleanDigest(raw, groupNames, picked.map((i) => i.id), false);
    if (!digest) throw new Error('토스 주간 리포트 정리 모양이 맞지 않음');
    // 화면이 가리키는 소식만 남긴다(응답 크기)
    const used = new Set([...digest.sections.flatMap((s) => s.ids), ...digest.keywords.flatMap((k) => k.ids), ...(digest.next ?? []).flatMap((n) => n.ids)]);
    return {
      start,
      title: reportTitle('week', start),
      range: reportRange('week', start),
      digest: { ...digest, personal: [] },
      total: digestItems.length,
      groups,
      items: Object.fromEntries(Object.entries(items).filter(([id]) => used.has(Number(id)))),
    };
  },
  ['toss-report-v1'],
  { revalidate: 7 * 86400 },
);

/** 지난주 주간 리포트(토스 공통판). 못 만들면 null */
export async function tossWeeklyReport(): Promise<TossReport | null> {
  try {
    return await reportOf(lastCompleted('week', kstDate()));
  } catch (e) {
    console.warn('[toss] 주간 리포트 실패', String((e as Error)?.message ?? e).slice(0, 200));
    return null;
  }
}
