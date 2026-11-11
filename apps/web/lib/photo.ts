// 원문 사진을 복사하지 않고 덜 받기(2026-11-11 성능 2번 A안. 정책: 맹고-문서/소식-고르기와-출처.md '원문 사진' — 이미지 파일은 맹고에 복사하지 않는다).
// - 사진이 아닌 대표 이미지(사이트가 만든 링크 카드, 로고)는 사진 자리에 넣지 않는다
// - 작게 그리는 자리는 언론사가 자기 서버에서 원래 주는 작은 크기 주소를 쓴다(우리 서버에 두지 않는다). 2026-11-11에 주소마다 실제로 받아 보고 확인한 곳만
// 서버·화면 공용

/** 사진이 아닌 이미지(긱뉴스 링크 카드, 로고). 사진 자리에 넣지 않는다 */
export function isNotPhoto(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  if (u.hostname === "social.news.hada.io") return true;
  return /(^|[/_.-])logo([/_.-]|$)/i.test(u.pathname);
}

/** 그리는 크기: list는 목록 칸(약 84~108px), card는 카드 보기(약 170~360px) */
export type PhotoSize = "list" | "card";

/** 그 크기로 받을 언론사 주소. 확인한 곳이 아니면 null(원본 그대로) */
export function smallPhoto(url: string, size: PhotoSize = "list"): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const h = u.hostname;
  const swap = (path: string) => (path !== u.pathname ? `${u.origin}${path}${u.search}` : null);
  // SBS: _1280.jpg → _300(목록)·_700(카드). 160KB → 10KB·51KB
  if (h === "img.sbs.co.kr") return swap(u.pathname.replace(/_\d{3,4}\.(jpe?g|png)$/i, `_${size === "list" ? 300 : 700}.$1`));
  // 한국경제: .1.jpg → .3.jpg(400×300). 214KB → 36KB
  if (h === "img.hankyung.com") return swap(u.pathname.replace(/\.1\.(jpe?g|png)$/i, ".3.$1"));
  // 동아: 크기 조절 주소 /a/<폭>/0/90/5/<원래 경로>. 240KB → 11KB(300)·38KB(600)
  if (h === "dimg.donga.com" && u.pathname.startsWith("/wps/")) return `${u.origin}/a/${size === "list" ? 300 : 600}/0/90/5${u.pathname}`;
  // 더버지: ?w=1200 → 320(목록)·720(카드). 80KB → 6KB
  if (h === "platform.theverge.com" && u.searchParams.has("w")) {
    const v = new URL(u);
    v.searchParams.set("w", size === "list" ? "320" : "720");
    v.searchParams.set("quality", "80");
    return v.toString();
  }
  // 국내 언론 CMS(AI타임스·로봇신문 등 /news/photo/YYYYMM/a_b_c.ext) → /news/thumbnail/YYYYMM/a_b_c_v150.jpg(폭 300). 946KB → 18KB
  const m = u.pathname.match(/^\/news\/photo\/(\d{6})\/(\d+_\d+_\d+)\.(jpe?g|png|gif)$/i);
  if (m) return `${u.origin}/news/thumbnail/${m[1]}/${m[2]}_v150.jpg`;
  return null;
}
