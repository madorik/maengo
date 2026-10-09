// 유튜브 주소에서 영상 ID를 뽑고 썸네일 주소를 만든다. 수집 단계와 화면이 같이 쓴다.

const ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null;
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
        id = m?.[1] ?? null;
      }
    }
    return id && ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** 480×360. 모든 영상에 있는 크기라 깨질 일이 없다 */
export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
