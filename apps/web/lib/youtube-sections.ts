import { classifyByKeywords } from "@maengo/core/categories";
import { SECTION_IDS, sectionOf, type SectionId } from "@maengo/core/sections";

// 유튜브 구독 채널로 관심 분야 찾기(2026-11-10 사용자: '유튜브 구독으로 찾기'를 누르게 하면 안 할 테니 구글 로그인 때 자동으로).
// 채널 이름·소개를 글 종류 키워드 분류기로 나눠 분야로 묶는다(LLM 비용 0). 화면(온보딩 결과)과 서버가 같이 쓴다

export interface YoutubeChannel {
  title: string;
  description: string;
}

/** 분야별 비중(0.8~1.5)과 분야마다 보여 줄 채널 이름(많아야 3개). 분야를 못 정한 채널은 뺀다 */
export interface YoutubeSections {
  weights: Partial<Record<SectionId, number>>;
  channels: Partial<Record<SectionId, string[]>>;
  /** 분야를 정한 채널 수 */
  matched: number;
}

/** 분야를 정한 채널이 이보다 적으면 쓰지 않는다(소식 고르기로) */
export const MIN_MATCHED = 3;

/** 채널 이름에 흔한 말 중 분류를 흐리는 것('브이로그'는 기술 키워드 '로그'에 걸린다) */
const clean = (s: string) => s.replace(/브이로그|vlog/gi, ' ');

export function sectionsFromChannels(list: readonly YoutubeChannel[]): YoutubeSections | null {
  const counts = new Map<SectionId, number>();
  const channels: Partial<Record<SectionId, string[]>> = {};
  for (const c of list) {
    const category = classifyByKeywords({ title: clean(c.title), short: clean(c.description.slice(0, 300)), body: [] });
    const section = sectionOf({ category });
    if (!section) continue;
    counts.set(section, (counts.get(section) ?? 0) + 1);
    const names = (channels[section] ??= []);
    if (names.length < 3) names.push(c.title.trim());
  }
  const matched = [...counts.values()].reduce((a, n) => a + n, 0);
  if (matched < MIN_MATCHED) return null;
  const max = Math.max(...counts.values());
  const weights: Partial<Record<SectionId, number>> = {};
  for (const id of SECTION_IDS) {
    const n = counts.get(id);
    if (n) weights[id] = Math.round((0.8 + 0.7 * (n / max)) * 100) / 100;
  }
  return { weights, channels, matched };
}

/** 쿠키에 담은 값 읽기(모양이 틀리면 null) */
export function parseYoutubeSections(raw: string | undefined): YoutubeSections | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as YoutubeSections;
    const ok = v && typeof v === "object" && typeof v.matched === "number" && v.weights && Object.keys(v.weights).every((k) => (SECTION_IDS as string[]).includes(k));
    return ok ? v : null;
  } catch {
    return null;
  }
}
