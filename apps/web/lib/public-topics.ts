// 공개 분야 페이지(/topics/…). 로그인 없이 누구나 보고 검색에도 열린다(2026-10-18).
// 관심 분야 5개만 연다. 뉴스 분야(정치·경제 등)는 언론사 헤드라인이라 소식 목록을 공개하지 않고 분야 목록에서 이름만 보인다.
import { childrenOf, NEWS_SECTIONS, TOPIC_GROUPS } from "@maengo/core/topics";

export interface PublicTopic {
  /** 주소 조각(/topics/<slug>) */
  slug: string;
  /** 토픽 사전의 큰 분류 id */
  id: string;
  name: string;
  /** 세부 관심사 이름(사전 순서) */
  details: string[];
}

// 주소는 토픽 id를 그대로 쓰되, 화면 이름이 Tech인 dev만 tech로 연다
const SLUG: Record<string, string> = { dev: "tech" };

export const PUBLIC_TOPICS: PublicTopic[] = TOPIC_GROUPS.map((g) => ({
  slug: SLUG[g.id] ?? g.id,
  id: g.id,
  name: g.name,
  details: childrenOf(g.id).map((t) => t.name),
}));

/** 뉴스 분야 이름(정치, 경제, …). 공개 페이지는 없다 */
export const NEWS_SECTION_NAMES = NEWS_SECTIONS.map((t) => t.name);

export function publicTopicBySlug(slug: string): PublicTopic | undefined {
  return PUBLIC_TOPICS.find((t) => t.slug === slug);
}

export const topicsPath = (slug?: string) => (slug ? `/topics/${slug}` : "/topics");

/**
 * 세부 주제 페이지(/topics/<분야>/<주제>, 2026-11-10 사용자 결정 '주제별로 하나씩 만들어서 검색 유입 늘리자').
 * 사람들이 실제로 치는 주제(비트코인, 미국 주식, LLM …)로 검색에 걸리게 한다. 소식 한 건마다의 페이지는 여전히 만들지 않는다(맹고-문서/검색-노출.md)
 */
export interface PublicDetail {
  /** 주소 조각(/topics/<분야>/<slug>) */
  slug: string;
  /** 토픽 사전의 세부 관심사 id */
  id: string;
  name: string;
  /** 사전의 다른 이름(검색어: BTC, 비트코인 ETF …) */
  aliases: string[];
  group: PublicTopic;
}

// 주소는 사전 id를 쓰되 검색에 보이는 주소가 읽히게 몇 개만 바꾼다
const DETAIL_SLUG: Record<string, string> = {
  "llm-dev": "llm",
  "llm-agent": "ai-agent",
  "ai-automation": "automation",
  "gen-media": "image-video",
  "stock-us": "us-stock",
  macro: "rates-fx",
  "crypto-reg": "regulation",
  "dev-release": "releases",
};

export const PUBLIC_DETAILS: PublicDetail[] = PUBLIC_TOPICS.flatMap((g) =>
  childrenOf(g.id).map((c) => ({ slug: DETAIL_SLUG[c.id] ?? c.id, id: c.id, name: c.name, aliases: c.aliases, group: g })),
);

export function publicDetailBySlug(groupSlug: string, slug: string): PublicDetail | undefined {
  return PUBLIC_DETAILS.find((d) => d.group.slug === groupSlug && d.slug === slug);
}

export const detailsOf = (g: PublicTopic) => PUBLIC_DETAILS.filter((d) => d.group.slug === g.slug);

export const detailPath = (d: PublicDetail) => `${topicsPath(d.group.slug)}/${d.slug}`;

/** 분야 이름 + 세부 관심사로 쓰는 소개 한 줄: "LLM, 바이브코딩, AI 에이전트 …" */
export function detailsLine(t: PublicTopic, max = t.details.length): string {
  const shown = t.details.slice(0, max);
  return shown.join(", ") + (t.details.length > max ? " 등" : "");
}
