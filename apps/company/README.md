# 회사 사이트 (watalabs.com)

와타랩스 회사 소개 페이지. 빌드 없는 정적 파일이다.

- Vercel 프로젝트 `watalabs`(팀 madoriks-projects)에 `watalabs.com`·`www.watalabs.com`이 붙어 있다.
- `vercel.json`이 `/maengo/*`를 맹고 프로젝트(`https://maengo.vercel.app/maengo/*`)로 넘긴다(Next.js 멀티존).
  맹고의 경로는 `apps/web/next.config.ts`의 basePath(`/maengo`)와 같아야 한다.
- 새 서비스를 붙일 때도 같은 방식: 그 앱에 basePath를 주고 여기 `vercel.json`에 rewrite를 더한다.
- `robots.txt`는 도메인 전체 규칙이라 맹고의 막는 경로도 여기에 같이 둔다.
- 배포: 이 폴더에서 `npx vercel deploy --prod`
- 광고(AdSense, 2026-11-13): 이 사이트에는 광고를 넣지 않는다. 하위 도메인(`lasee.watalabs.com` 등)에 광고를 걸려면 Google 이
  루트 도메인의 `ads.txt` 를 보므로 `ads.txt` 와 `index.html` 의 `google-adsense-account` 메타 · AdSense 코드(소유권 확인)만 둔다.
  광고 칸은 없으니 AdSense 에서 이 사이트의 자동 광고를 켜지 않는다(켜면 회사 소개 쪽에 광고가 뜬다).
  게시자 ID 는 `pub-6951210541539723`. AdSense 에는 루트 도메인 `watalabs.com` 을 사이트로 올린다.
- 화면 구성(2026-11-21 개편): 큰 문장 한 줄 + 만든 앱 아이콘 줄 → 소개(소개글·만드는 원칙) → 만든 앱(맹고 → 라씨 → 기억해유 → 캠핑장, 좌우로 번갈아) → 문의 → 사업자 정보. 앱 장은 한 줄 소개 + 3~4줄만 두고 앱의 실제 화면을 글 옆에 둔다: 맹고 폰 3장, MDitor 라씨 창(문서·MD·미리보기·PDF 탭), 기억해유 폰 3장(앱 크림색 판), 눈꽃숲 캠핑장 게임 장면(위로 눈 캔버스). '화면 캡처는 두지 않는다'(2026-10-28)는 사용자 지시로 바뀌었다. 앱 소개 문구는 각 앱의 소개문(스토어 등록정보·llms.txt)을 줄여 왔다. 앱을 더하면 JSON-LD·llms.txt·sitemap lastmod도 같이 고친다.
- 앱 화면 이미지는 `img/*.webp`다. 맹고는 `apps/web/components/landing/app-*.webp`, 라씨는 `mditor-lasee/web/src/assets/landing/ko/*.webp`를 그대로 복사했다. 기억해유는 로컬 개발 서버(`localhost:3200`)에서 데모 계정으로 직접 찍은 것(앱 디자인이 바뀌면 다시 찍는다. 예전 스토어 스크린샷은 옛 디자인이다). 캠핑장은 `camp-game`을 로컬로 띄워 `?season=winter`로 조작 UI(`#hud`)를 숨기고 찍었다(운영 사이트는 9~11월에 단풍 장면이라 겨울 장면은 이렇게만 나온다). 앱 화면이 바뀌면 같이 갈아 끼운다.
- 기억해유 '열기'(2026-11-21): 웹 화면(로그인)으로 보내지 않고 앱 받기 주소 `https://remember-you.watalabs.com/get?from=share_company`로 보낸다. `/get`이 기기에 맞는 곳으로 보낸다(아이폰 App Store, 안드로이드·PC Play 스토어). 단 PC(맥·윈도)는 Play가 비공개 테스트라 '찾을 수 없음'이 떠서 index.html 스크립트가 App Store 화면(`https://apps.apple.com/kr/app/id6834970170`)으로 바로 보낸다(Play가 정식 출시되면 이 분기를 없애고 `/get`에 맡긴다). `from`은 `share`로 시작해야 아이폰이 App Store로 간다(아니면 웹 홈=로그인으로 빠진다). 아이폰은 앱이 깔려 있으면 App Store 화면에 '열기'가 뜬다. 안드로이드는 index.html 끝의 스크립트가 `intent://home…`(= `kr.readme.app://home`)으로 앱을 먼저 열어 보고, 없거나 못 열면 2초 뒤 같은 주소로 보낸다. 앱의 유니버설 링크·앱 링크는 `/r/`·`/s/`만 다뤄서 웹에서 앱을 자동으로 여는 길은 이것뿐이다(아이폰까지 자동으로 열려면 앱을 새로 내서 경로를 더해야 한다).
- 검색·AI 노출(2026-10-18):
  - `index.html`의 JSON-LD `Organization`(@id `https://watalabs.com/#organization`)을 맹고 페이지가 운영사로 가리킨다(`apps/web/lib/site.ts`의 `organizationJsonLd`). 이름·메일을 바꾸면 둘 다 바꾼다.
  - `og.png`: 링크 공유 카드(1200×630).
  - `llms.txt`: AI가 읽는 사이트 요약. 맹고 분야·요금·주요 페이지가 바뀌면 같이 고친다.
  - `<키>.txt`: IndexNow 키 파일. 배포 뒤 `pnpm indexnow`로 두 사이트맵 주소를 빙·네이버 등에 알린다(`scripts/indexnow.mjs`).
- 브랜드(2026-10-27, 정책은 `맹고-문서/와타랩스-브랜드.md`):
  - 심볼 = 남색(#1F2340) 타일 위 맹고색(#FFC23D) 미소 w. 이름 글꼴 Jua, 본문 Pretendard(둘 다 OFL).
  - `favicon.svg`(둥근 타일), `apple-touch-icon.png`(180, 꽉 찬 사각형 — iOS가 모서리를 깎는다), `og.png`(남색 바탕 + 미소 + 이름).
  - `brand/`: `symbol.svg`(둥근 타일), `symbol-square.svg`·`symbol-1024.png`(꽉 찬 사각형, 스토어·계정 프로필용), `smile.svg`(타일 없는 미소, 어두운 바탕용), `logo-ko.png`·`logo-en.png`(심볼 + 이름, 투명 바탕 2배).
- 가이드 · 노트 · 정책(2026-11-26, AdSense '가치가 별로 없는 콘텐츠' 불합격 뒤 보강): `/guides.html`(목록), `/guides/*.html`(마크다운 보고서 · 표 칸 합치기 · PDF 쪽 나눔 · 선물 기록 · 뉴스 습관), `/notes/lasee-performance.html`(기술 노트), `/privacy.html`(이 사이트의 개인정보처리방침 — AdSense 쿠키 고지 포함).
  - 공통 머리 · 바닥글과 본문은 `_build/` 의 생성 스크립트에 있다: 글을 고치거나 더하면 `pages_*.py` 를 고치고 `python3 _build/build_pages.py` 로 HTML 을 다시 만든다(`_build` 는 `.vercelignore` 로 배포에서 뺀다). 모양은 `notes.css`.
  - 앱 설명은 `llms.txt` 의 사실만 쓴다. 쪽을 더하면 `sitemap.xml` · `llms.txt` · 첫 화면의 '가이드 · 노트' 칸도 같이 고친다.

