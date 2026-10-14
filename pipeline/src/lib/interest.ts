import { isNewsSection } from '@maengo/core/topics';
import { dictionary } from './audience';
import type { Ctx } from './ctx';
import { check, db, selectAll } from './db';
import { SECTION_BY_SOURCE_URL } from './headline';

// 관심사 거름: 글을 임베딩(Gemini 유료)하기 전에, 누군가 고른 관심사에 걸리는 글만 남긴다.
// 출처 79곳에서 하루 4천 개 넘게 모이는데 피드에 쓰이는 건 그중 일부라, 전부 임베딩하면 돈이 샌다(2026-10-14).
// - 관심사(분야·상세·기타): 이름·별칭이 제목이나 설명에 들어간 글. 분야를 고르면 그 분야의 상세 관심사 낱말도 쓴다
// - 뉴스 분야(정치·경제 등): 낱말 대신 그 분야 섹션 피드의 글(헤드라인은 언론사 여럿의 기사가 한 묶음에 모여야 한다)

export interface ItemText {
  title: string;
  excerpt: string | null;
  source_id: number | null;
}

/** 지금 관심사를 하나라도 고른 사람들의 관심사 전체 */
export async function topicsInUse(): Promise<Set<string>> {
  const rows = await selectAll<{ topic_id: string; profiles: { onboarded_at: string | null } | null }>((f, t) =>
    db.from('user_topics').select('topic_id, profiles!inner(onboarded_at)').not('profiles.onboarded_at', 'is', null).range(f, t),
  );
  return new Set(rows.map((r) => r.topic_id));
}

/** 이 관심사들에 걸리는 글인지 가리는 함수 */
export async function interestFilter(ctx: Ctx, topics: Set<string>): Promise<(item: ItemText) => boolean> {
  const words = (await dictionary(ctx))
    .filter((t) => !isNewsSection(t.id) && (topics.has(t.id) || (t.parent && topics.has(t.parent))))
    .flatMap((t) => [t.name, ...t.aliases]);
  const hits = matcher(words);
  const sections = new Set([...topics].filter(isNewsSection));
  const sectionSources = new Set<number>();
  if (sections.size) {
    const rows = check(await db.from('sources').select('id,url'), 'sources') as { id: number; url: string }[];
    for (const r of rows) if (sections.has(SECTION_BY_SOURCE_URL.get(r.url) ?? '')) sectionSources.add(r.id);
  }
  return (i) => sectionSources.has(i.source_id ?? -1) || hits(`${i.title} ${i.excerpt ?? ''}`);
}

/** 글에 관심사 단어가 들었는지. 영문은 낱말 단위로(AI가 said에 걸리지 않게), 한글은 그대로 찾는다 */
export function matcher(words: string[]): (text: string) => boolean {
  const ascii: RegExp[] = [];
  const other: string[] = [];
  for (const w of new Set(words.map((x) => x.trim().toLowerCase()).filter((x) => x.length >= 2))) {
    if (/^[\x00-\x7f]+$/.test(w)) ascii.push(new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`));
    else other.push(w);
  }
  return (text) => {
    const t = text.toLowerCase();
    return other.some((w) => t.includes(w)) || ascii.some((r) => r.test(t));
  };
}
