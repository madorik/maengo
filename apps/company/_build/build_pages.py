"""watalabs.com 가이드 · 노트 · 정책 쪽을 만든다(정적 HTML). 공통 머리 · 바닥글은 여기서 찍고 본문은 pages_*.py 에 있다."""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
BASE = "https://watalabs.com"
ORG = {"@id": f"{BASE}/#organization"}
DATE = "2026-11-26"

MARK = ('<svg class="mk" viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" rx="30"/>'
        '<path d="M32 53 A14 14 0 0 0 60 53 A14 14 0 0 0 88 53" fill="none" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>')

FOOTER = """<footer>
  <div class="wrap">
    <ul class="links">
      <li><a href="/">와타랩스</a></li>
      <li><a href="/guides.html">가이드 · 노트</a></li>
      <li><a href="/privacy.html">개인정보처리방침</a></li>
      <li><a href="mailto:watalabs.help@gmail.com">문의</a></li>
    </ul>
    <p class="copy">© 2026 와타랩스</p>
    <ul class="biz">
      <li><span>상호</span>와타랩스</li>
      <li><span>대표</span>정민균</li>
      <li><span>사업자등록번호</span>422-17-02792</li>
      <li><span>통신판매업 신고</span>제2026-서울서초-3688호</li>
      <li><span>주소</span>서울특별시 서초구 방배로 141, 4층 415-47호(방배동, 텔콤빌딩 내방)</li>
      <li><span>이메일</span>watalabs.help@gmail.com</li>
      <li><a href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=4221702792" target="_blank" rel="noopener noreferrer">사업자정보 확인</a></li>
    </ul>
  </div>
</footer>"""


def page(path: str, title: str, desc: str, body: str, *, kicker: str = "", crumbs: list[tuple[str, str]] | None = None,
         kind: str = "Article", nav: str = "", lede: str = "", image: str = "/og.png") -> None:
    url = f"{BASE}/{path}"
    e = html.escape
    crumbs = crumbs or []
    graph: list[dict] = []
    if kind == "Article":
        graph.append({
            "@type": "Article", "@id": f"{url}#article", "headline": title, "description": desc, "url": url,
            "inLanguage": "ko-KR", "datePublished": DATE, "dateModified": DATE, "author": ORG, "publisher": ORG,
            "image": f"{BASE}{image}", "mainEntityOfPage": url, "isPartOf": {"@id": f"{BASE}/#website"},
        })
    else:
        graph.append({"@type": "WebPage", "@id": url, "name": title, "description": desc, "url": url, "inLanguage": "ko-KR",
                      "dateModified": DATE, "publisher": ORG, "isPartOf": {"@id": f"{BASE}/#website"}})
    items = [{"@type": "ListItem", "position": 1, "name": "와타랩스", "item": f"{BASE}/"}]
    for i, (name, href) in enumerate(crumbs, 2):
        items.append({"@type": "ListItem", "position": i, "name": name, "item": f"{BASE}{href}"})
    items.append({"@type": "ListItem", "position": len(items) + 1, "name": title, "item": url})
    graph.append({"@type": "BreadcrumbList", "itemListElement": items})
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    crumb_html = '<a href="/">와타랩스</a>' + "".join(f' › <a href="{h}">{e(n)}</a>' for n, h in crumbs)
    navs = [("/guides.html", "가이드"), ("/#apps", "만든 앱"), ("/#contact", "문의")]
    cur = ' aria-current="page"'
    nav_html = "".join(f'<a href="{h}"{cur if h == nav else ""}>{n}</a>' for h, n in navs)
    doc = f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{e(title)} — 와타랩스</title>
  <meta name="description" content="{e(desc)}" />
  <link rel="canonical" href="{url}" />
  <meta name="google-adsense-account" content="ca-pub-6951210541539723" />
  <meta name="robots" content="max-image-preview:large" />
  <meta property="og:type" content="{'article' if kind == 'Article' else 'website'}" />
  <meta property="og:locale" content="ko_KR" />
  <meta property="og:site_name" content="와타랩스" />
  <meta property="og:title" content="{e(title)}" />
  <meta property="og:description" content="{e(desc)}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{BASE}{image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#F6F7FA" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#151722" media="(prefers-color-scheme: dark)" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
  <link rel="stylesheet" href="/notes.css" />
  <script type="application/ld+json">{ld}</script>
</head>
<body>
<header class="top wrap">
  <a class="brand" href="/">{MARK}<span>와타랩스</span></a>
  <nav aria-label="바로가기">{nav_html}</nav>
</header>
<main class="wrap page">
  <nav class="crumbs" aria-label="현재 위치">{crumb_html}</nav>
  <article>
    {f'<p class="kicker">{e(kicker)}</p>' if kicker else ''}
    <h1>{e(title)}</h1>
    {f'<p class="lede">{lede}</p>' if lede else ''}
    <p class="meta">{'2026년 11월 26일 · ' if kind == 'Article' else ''}와타랩스</p>
{body}
  </article>
</main>
{FOOTER}
</body>
</html>
"""
    target = OUT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(doc, encoding="utf-8")
    print("wrote", path, len(body))


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    import pages_guides  # noqa: F401  — 각 모듈이 page() 를 부른다
    import pages_more  # noqa: F401
