import 'server-only';
import { cookies } from 'next/headers';
import { sectionsFromChannels, type YoutubeChannel, type YoutubeSections } from '../youtube-sections';

// 구글 로그인 때 유튜브 구독 채널을 읽어 관심 분야를 찾는다(lib/youtube-sections.ts). YOUTUBE_INTERESTS=1일 때만.
// 유튜브 읽기 권한(youtube.readonly)은 구글의 민감 범위라 구글 앱 검증을 받은 뒤 켠다(맹고-문서/맞춤-소식.md).
// 접근 토큰은 저장하지 않는다: 로그인하는 그 순간 한 번 읽고, 찾은 분야만 잠깐 쿠키에 두었다가 온보딩이 쓰고 지운다

export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
export const YOUTUBE_COOKIE = 'maengo_yt_sections';
const COOKIE_TTL_SEC = 30 * 60;
/** 많아야 4쪽(200채널) */
const MAX_PAGES = 4;

export const youtubeInterestsEnabled = () => process.env.YOUTUBE_INTERESTS === '1';

async function subscriptionChannels(accessToken: string): Promise<YoutubeChannel[]> {
  const out: YoutubeChannel[] = [];
  let page: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const q = new URLSearchParams({ part: 'snippet', mine: 'true', maxResults: '50', ...(page ? { pageToken: page } : {}) });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/subscriptions?${q}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // 권한을 안 줬으면 403. 소식 고르기로 넘어간다
      console.warn('[youtube] 구독 목록 못 읽음', res.status);
      break;
    }
    const body = (await res.json()) as { items?: { snippet?: { title?: string; description?: string } }[]; nextPageToken?: string };
    for (const it of body.items ?? []) out.push({ title: it.snippet?.title ?? '', description: it.snippet?.description ?? '' });
    page = body.nextPageToken;
    if (!page) break;
  }
  return out;
}

/** 접근 토큰으로 구독 채널을 읽어 분야를 찾는다. 실패하거나 못 찾으면 null(로그인은 그대로 이어 간다) */
export async function youtubeSections(accessToken: string | null | undefined, grantedScope?: string | null): Promise<YoutubeSections | null> {
  if (!youtubeInterestsEnabled() || !accessToken) return null;
  if (grantedScope && !grantedScope.split(' ').includes(YOUTUBE_SCOPE)) return null;
  try {
    return sectionsFromChannels(await subscriptionChannels(accessToken));
  } catch (e) {
    console.warn('[youtube] 구독으로 관심사 찾기 실패', (e as Error).message);
    return null;
  }
}

/** 찾은 분야를 온보딩이 쓰게 잠깐 남긴다 */
export async function keepYoutubeSections(found: YoutubeSections | null): Promise<void> {
  if (!found) return;
  const jar = await cookies();
  jar.set(YOUTUBE_COOKIE, JSON.stringify(found), { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: COOKIE_TTL_SEC });
}
