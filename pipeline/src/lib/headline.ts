import { NEWS_SECTIONS } from '@maengo/core/topics';
import { SOURCES, type NewsSectionId } from '../sources';

// 뉴스 분야 헤드라인 판정. 네이버 뉴스 헤드라인은 같은 소식을 다룬 기사 묶음을 관련 기사 수로 고른다.
// 맹고도 같다: 묶음(cluster)에 든 국내 기사를 언론사별로 세어 MIN_OUTLETS곳 이상이면 헤드라인이다.
// - 언론사는 기사 주소의 도메인으로 센다(연합뉴스 정치·사회 피드의 기사는 같은 언론사). 영상·해외 기사는 세지 않는다.
// - 분야는 섹션 피드(sources.ts의 section)에서 온 기사들의 섹션 중 가장 많은 것(같으면 NEWS_SECTIONS 순서).
//   섹션 피드 기사가 하나도 없으면(블로그·전문지끼리만 겹친 소식) 헤드라인이 아니다.
// - 날씨·로또·운세·부고·인사·사진 같은 정례 기사는 언론사마다 똑같이 내서 겹치지만 소식이 아니다. 세지 않는다.

export const MIN_OUTLETS = Number(process.env.PIPELINE_HEADLINE_MIN_OUTLETS) || 3;

/** 출처 피드 주소 → 뉴스 분야 */
export const SECTION_BY_SOURCE_URL: ReadonlyMap<string, NewsSectionId> = new Map(SOURCES.filter((s) => s.section).map((s) => [s.url, s.section!]));

const ORDER = NEWS_SECTIONS.map((t) => t.id);

// 국가 도메인의 2단계 이름(sbs.co.kr, kbs.or.kr). 이 경우 끝 세 마디가 언론사다
const SECOND_LEVEL = new Set(['co', 'or', 'go', 'ne', 're', 'ac', 'pe']);

/** 기사 주소의 언론사(등록 도메인): news.sbs.co.kr → sbs.co.kr, www.donga.com → donga.com */
export function outletOf(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const parts = host.split('.');
  const n = parts.length >= 3 && parts.at(-1)!.length === 2 && SECOND_LEVEL.has(parts.at(-2)!) ? 3 : 2;
  return parts.slice(-n).join('.');
}

// 2026-10-11 섹션 피드 40곳 제목에서 본 정례 기사 꼴. [속보]·[단독]은 소식이라 넣지 않는다
const ROUTINE = /\[(?:포토|사진|오늘의 ?날씨|날씨[^\]]*|오늘의 ?운세|운세|부고|인사|게시판|알림|모십니다)\]|로또 ?\d+회|당첨 ?번호|띠별 ?운세|오늘의 ?운세|^\s*\(?(?:부고|인사)\)?\s/;

/** 소식이 아닌 정례 기사 제목인지 */
export function isRoutineTitle(title: string): boolean {
  return ROUTINE.test(title);
}

export interface HeadlineMember {
  url: string;
  title: string;
  kind: 'article' | 'video';
  /** 출처 언어. 출처를 모르면 null */
  lang: 'ko' | 'en' | null;
  /** 섹션 피드에서 왔으면 그 분야 */
  section: NewsSectionId | null;
}

/** 헤드라인이면 분야와 언론사 수, 아니면 null */
export function headlineOf(members: HeadlineMember[], minOutlets = MIN_OUTLETS): { section: NewsSectionId; outlets: number } | null {
  const outlets = new Set<string>();
  const votes = new Map<NewsSectionId, number>();
  for (const m of members) {
    if (m.kind !== 'article' || m.lang !== 'ko' || isRoutineTitle(m.title)) continue;
    const o = outletOf(m.url);
    if (o) outlets.add(o);
    if (m.section) votes.set(m.section, (votes.get(m.section) ?? 0) + 1);
  }
  if (outlets.size < minOutlets || !votes.size) return null;
  const [section] = [...votes].sort((a, b) => b[1] - a[1] || ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))[0]!;
  return { section, outlets: outlets.size };
}
