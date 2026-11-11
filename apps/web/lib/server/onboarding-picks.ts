import 'server-only';
import { isCategory } from '@maengo/core/categories';
import { POPULAR_SECTION_ORDER, SECTION_IDS, SECTION_LABEL, sectionOf, type SectionId } from '@maengo/core/sections';
import { isNewsSection, TOPIC_BY_ID } from '@maengo/core/topics';
import { db } from './db';
import { storyPhotos } from './feed';

/** 온보딩 '끌리는 소식' 타일 하나(2026-11-10): 분야마다 최근 소식 하나, 고르면 그 분야 비중이 올라간다 */
export interface OnboardingPick {
  clusterId: number;
  section: SectionId;
  sectionLabel: string;
  title: string;
  photo: string | null;
  /** 이 소식의 세부 관심사 이름(코스피, LLM 등). 결과 화면에 '이런 걸 좋아하시네요'로 보인다. 없으면 null */
  detail: string | null;
}

/**
 * 분야마다 하나씩, 요약된 소식 중 사진이 있고 많은 언론이 다룬 것. 최근 사흘 안 소식을 먼저 고르고, 없으면 2주 안에서(2026-11-11 사용자:
 * 부동산·엔터·스포츠도 보이게). 그래도 없으면 그 분야는 빠진다(AI 호출 없음).
 * 순서는 사람들이 많이 보는 분야부터(sectionOrder: 회원들의 최근 30일 읽기·듣기, 기록이 적으면 POPULAR_SECTION_ORDER)
 */
export async function onboardingPicks(): Promise<OnboardingPick[]> {
  const recent = Date.now() - 72 * 3600_000;
  const since = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
  const { data, error } = await db
    .from('summaries')
    .select('cluster_id,title,category,created_at,clusters!inner(size)')
    .eq('tier', 'basic')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1500);
  if (error) throw new Error(`onboarding picks: ${error.message}`);
  const rows = (data ?? []) as unknown as { cluster_id: number; title: string; category: string; created_at: string; clusters: { size: number } }[];
  const ids = rows.map((r) => r.cluster_id);
  const [photos, topics] = await Promise.all([storyPhotos(ids), clusterTopics(ids)]);
  const best = new Map<SectionId, { row: (typeof rows)[number]; score: number }>();
  for (const r of rows) {
    // 소식 자신의 분류가 먼저(헤드라인 분야 토픽은 여러 분야에 붙기도 한다), 없으면 붙은 토픽에서
    const section = sectionOf({ category: isCategory(r.category) ? r.category : null }) ?? sectionOf({ topicIds: topics.get(r.cluster_id)?.map((t) => t.topicId) });
    if (!section) continue;
    const score = (Date.parse(r.created_at) >= recent ? 1000 : 0) + (photos.has(r.cluster_id) ? 100 : 0) + (r.clusters?.size ?? 1);
    const cur = best.get(section);
    if (!cur || score > cur.score) best.set(section, { row: r, score });
  }
  const order = await sectionOrder();
  return order.flatMap((section) => {
    const b = best.get(section);
    if (!b) return [];
    const detailId = topics.get(b.row.cluster_id)?.find((t) => !isNewsSection(t.topicId) && TOPIC_BY_ID.has(t.topicId))?.topicId;
    return [
      {
        clusterId: b.row.cluster_id,
        section,
        sectionLabel: SECTION_LABEL[section],
        title: b.row.title,
        photo: photos.get(b.row.cluster_id)?.url ?? null,
        detail: detailId ? (TOPIC_BY_ID.get(detailId)?.name ?? null) : null,
      },
    ];
  });
}

async function clusterTopics(ids: number[]): Promise<Map<number, { topicId: string; relevance: number }[]>> {
  const out = new Map<number, { topicId: string; relevance: number }[]>();
  if (!ids.length) return out;
  const { data } = await db.from('cluster_topics').select('cluster_id,topic_id,relevance').in('cluster_id', ids).gte('relevance', 0.4);
  for (const r of (data ?? []) as { cluster_id: number; topic_id: string; relevance: number }[]) {
    (out.get(r.cluster_id) ?? out.set(r.cluster_id, []).get(r.cluster_id)!).push({ topicId: r.topic_id, relevance: r.relevance });
  }
  for (const list of out.values()) list.sort((a, b) => b.relevance - a.relevance);
  return out;
}

/**
 * 사람들이 많이 보는 분야 순서: 회원들이 최근 30일 동안 읽거나 들은 소식을 분야로 센다(글 종류 → 분야). 많이 본 분야부터,
 * 같거나 기록이 없는 분야는 POPULAR_SECTION_ORDER 순서. 한 시간 동안은 센 값을 다시 쓴다
 */
let orderCache: { at: number; order: SectionId[] } | null = null;
async function sectionOrder(): Promise<SectionId[]> {
  if (orderCache && Date.now() - orderCache.at < 3600_000) return orderCache.order;
  const counts = new Map<SectionId, number>();
  try {
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const { data: reads } = await db.from('reads').select('cluster_id').or(`read_at.gte.${since},listened_at.gte.${since}`).limit(5000);
    const ids = [...new Set(((reads ?? []) as { cluster_id: number }[]).map((r) => r.cluster_id))];
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await db.from('summaries').select('category').eq('tier', 'basic').in('cluster_id', ids.slice(i, i + 500));
      for (const row of (data ?? []) as { category: string }[]) {
        const sec = isCategory(row.category) ? sectionOf({ category: row.category }) : null;
        if (sec) counts.set(sec, (counts.get(sec) ?? 0) + 1);
      }
    }
  } catch {
    // 못 세면 기본 순서
  }
  const rank = (id: SectionId) => POPULAR_SECTION_ORDER.indexOf(id);
  // 기록이 적을 때(30건 미만)는 기본 순서를 그대로 쓴다(몇 사람 기록에 순서가 흔들리지 않게)
  const total = [...counts.values()].reduce((a, n) => a + n, 0);
  const order = [...SECTION_IDS].sort((a, b) => (total >= 30 ? (counts.get(b) ?? 0) - (counts.get(a) ?? 0) : 0) || rank(a) - rank(b));
  orderCache = { at: Date.now(), order };
  return order;
}
