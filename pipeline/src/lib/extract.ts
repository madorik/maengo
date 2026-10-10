import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { fetchText } from './http';

// 요약할 때만 원문을 읽는다. 본문은 메모리에만 두고 DB에 저장하지 않는다(PLAN.md 6.1).

const cache = new Map<string, string>();

export async function extractArticle(url: string, maxChars = 8000): Promise<string> {
  const hit = cache.get(url);
  if (hit !== undefined) return hit;
  let text = '';
  try {
    const html = await fetchText(url, { timeoutMs: 15_000 });
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse();
    text = (article?.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  } catch {
    text = '';
  }
  if (text.length > maxChars) text = text.slice(0, maxChars);
  cache.set(url, text);
  return text;
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
