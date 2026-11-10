import 'server-only';
import { isCategory } from '@maengo/core/categories';
import { SECTION_IDS, SECTION_LABEL, sectionOf, type SectionId } from '@maengo/core/sections';
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
 * 분야 8개에서 하나씩, 최근 사흘 안에 요약된 소식 중 많은 언론이 다룬 것(같으면 새것). 사진이 있는 소식을 먼저 고른다.
 * 그 분야 소식이 없으면 그 분야는 빠진다(AI 호출 없음)
 */
export async function onboardingPicks(): Promise<OnboardingPick[]> {
  const since = new Date(Date.now() - 72 * 3600_000).toISOString();
  const { data, error } = await db
    .from('summaries')
    .select('cluster_id,title,category,created_at,clusters!inner(size)')
    .eq('tier', 'basic')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw new Error(`onboarding picks: ${error.message}`);
  const rows = (data ?? []) as unknown as { cluster_id: number; title: string; category: string; created_at: string; clusters: { size: number } }[];
  const ids = rows.map((r) => r.cluster_id);
  const [photos, topics] = await Promise.all([storyPhotos(ids), clusterTopics(ids)]);
  const best = new Map<SectionId, { row: (typeof rows)[number]; score: number }>();
  for (const r of rows) {
    // 소식 자신의 분류가 먼저(헤드라인 분야 토픽은 여러 분야에 붙기도 한다), 없으면 붙은 토픽에서
    const section = sectionOf({ category: isCategory(r.category) ? r.category : null }) ?? sectionOf({ topicIds: topics.get(r.cluster_id)?.map((t) => t.topicId) });
    if (!section) continue;
    const score = (photos.has(r.cluster_id) ? 100 : 0) + (r.clusters?.size ?? 1);
    const cur = best.get(section);
    if (!cur || score > cur.score) best.set(section, { row: r, score });
  }
  return SECTION_IDS.flatMap((section) => {
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
