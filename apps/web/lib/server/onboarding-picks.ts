import 'server-only';
import { isCategory } from '@maengo/core/categories';
import { POPULAR_SECTION_ORDER, SECTION_IDS, SECTION_LABEL, sectionOf, type SectionId } from '@maengo/core/sections';
import { isNewsSection, TOPIC_BY_ID } from '@maengo/core/topics';
import { db } from './db';
import { storyPhotos } from './feed';

/** 온보딩 '끌리는 소식' 타일 하나(2026-11-10): 분야마다 최근 소식 하나, 고르면 그 분야 비중이 올라간다 */
export interface OnboardingPick {
  clusterId: number;
  /** 온보딩 묶음 자리: 분야 id, AI 소식이면 'ai'(2026-11-12 AI 묶음, lib/context.ts pick) */
  slot: string;
  section: SectionId;
  sectionLabel: string;
  title: string;
  photo: string | null;
  /** 이 소식의 세부 관심사 이름(코스피, LLM 등). 결과 화면에 '이런 걸 좋아하시네요'로 보인다. 없으면 null */
  detail: string | null;
}

/**
 * 사람들이 눈길을 줄 만한 이름(2026-11-12 사용자 '사람들이 관심 있어 할 만한 이미지로, 예를 들면 지금 젠슨 황도 이슈고'): 유명 인물·큰 기업.
 * 제목에 있으면 그 소식을 먼저 고른다(사진이 그 사람·회사일 때가 많다). 정치인은 넣지 않는다(편들기로 보이지 않게)
 */
const ISSUE =
  /젠슨\s?황|엔비디아|일론\s?머스크|머스크|테슬라|스페이스X|삼성|이재용|SK하이닉스|현대차|애플|팀\s?쿡|오픈AI|챗GPT|샘\s?올트먼|앤트로픽|구글|마이크로소프트|메타|저커버그|아마존|워런\s?버핏|비트코인|손흥민|이강인|김민재|오타니|류현진|김하성|이정후|BTS|방탄|블랙핑크|지수|제니|로제|뉴진스|에스파|아이브|아이유|임영웅|세븐틴|넷플릭스/;

/**
 * 분야마다 하나씩, 요약된 소식 중 사진이 있고 많은 언론이 다룬 것. 최근 사흘 안 소식을 먼저 고르고, 없으면 2주 안에서(2026-11-11 사용자:
 * 부동산·엔터·스포츠도 보이게). 그래도 없으면 그 분야는 빠진다(AI 호출 없음).
 * 순서는 사람들이 많이 보는 분야부터(sectionOrder: 회원들의 최근 30일 읽기·듣기, 기록이 적으면 POPULAR_SECTION_ORDER)
 */
export async function onboardingPicks(): Promise<OnboardingPick[]> {
  const recent = Date.now() - 48 * 3600_000;
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
  const best = new Map<string, { row: (typeof rows)[number]; score: number; section: SectionId }>();
  for (const r of rows) {
    // 소식 자신의 분류가 먼저(헤드라인 분야 토픽은 여러 분야에 붙기도 한다), 없으면 붙은 토픽에서
    const section = sectionOf({ category: isCategory(r.category) ? r.category : null }) ?? sectionOf({ topicIds: topics.get(r.cluster_id)?.map((t) => t.topicId) });
    if (!section) continue;
    // 사진이 없으면 고르지 않는다(온보딩은 사진이 주인공). 최근 이틀 → 유명 인물·기업 → 많이 다룬 순
    if (!photos.has(r.cluster_id)) continue;
    const score = (Date.parse(r.created_at) >= recent ? 1000 : 0) + (ISSUE.test(r.title) ? 300 : 0) + (r.clusters?.size ?? 1) * 10;
    // AI 소식은 'ai' 자리에서만 겨룬다(온보딩 AI 묶음 머리, IT/과학 묶음과 같은 소식이 겹치지 않게)
    for (const slot of r.category === 'ai' ? ['ai'] : [section]) {
      const cur = best.get(slot);
      if (!cur || score > cur.score) best.set(slot, { row: r, score, section });
    }
  }
  const order = await sectionOrder();
  return [...order, 'ai'].flatMap((slot) => {
    const b = best.get(slot);
    if (!b) return [];
    const section = b.section;
    const detailId = topics.get(b.row.cluster_id)?.find((t) => !isNewsSection(t.topicId) && TOPIC_BY_ID.has(t.topicId))?.topicId;
    return [
      {
        clusterId: b.row.cluster_id,
        slot,
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
