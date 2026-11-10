import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { cleanImageUrl } from './feed';
import { fetchText } from './http';

// 요약할 때만 원문을 읽는다. 본문은 메모리에만 두고 DB에 저장하지 않는다(PLAN.md 6.1).
// 읽은 김에 대표 이미지(og:image) 주소도 기억해 둔다. RSS에 이미지가 없던 글의 상세 화면 사진(2026-11-10)

const cache = new Map<string, string>();
const images = new Map<string, string | null>();

/** 페이지의 대표 이미지(og:image → twitter:image). Readability가 문서를 고치기 전에 읽는다 */
function ogImage(document: { querySelector(s: string): { getAttribute(n: string): string | null } | null }, url: string): string | null {
  for (const sel of ['meta[property="og:image"]', 'meta[property="og:image:url"]', 'meta[name="twitter:image"]']) {
    const found = cleanImageUrl(document.querySelector(sel)?.getAttribute('content'), url);
    if (found) return found;
  }
  return null;
}

export async function extractArticle(url: string, maxChars = 8000): Promise<string> {
  const hit = cache.get(url);
  if (hit !== undefined) return hit;
  let text = '';
  try {
    const html = await fetchText(url, { timeoutMs: 15_000 });
    const { document } = parseHTML(html);
    images.set(url, ogImage(document, url));
    const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
    text = (article?.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  } catch {
    text = '';
  }
  if (text.length > maxChars) text = text.slice(0, maxChars);
  cache.set(url, text);
  return text;
}

/** extractArticle로 읽은 페이지의 대표 이미지. 안 읽었거나 없으면 null */
export function articleImage(url: string): string | null {
  return images.get(url) ?? null;
}

/** 유튜브 영상 길이(초). 알 수 없으면 null */
export async function youtubeSeconds(videoId: string): Promise<number | null> {
  try {
    const html = await fetchText(`https://www.youtube.com/watch?v=${videoId}`, { timeoutMs: 15_000 });
    const m = html.match(/"lengthSeconds":"(\d+)"/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}
