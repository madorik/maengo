# 회사 사이트 (watalabs.com)

와타랩스 회사 소개 페이지. 빌드 없는 정적 파일이다.

- Vercel 프로젝트 `watalabs`(팀 madoriks-projects)에 `watalabs.com`·`www.watalabs.com`이 붙어 있다.
- `vercel.json`이 `/maengo/*`를 맹고 프로젝트(`https://maengo.vercel.app/maengo/*`)로 넘긴다(Next.js 멀티존).
  맹고의 경로는 `apps/web/next.config.ts`의 basePath(`/maengo`)와 같아야 한다.
- 새 서비스를 붙일 때도 같은 방식: 그 앱에 basePath를 주고 여기 `vercel.json`에 rewrite를 더한다.
- `robots.txt`는 도메인 전체 규칙이라 맹고의 막는 경로도 여기에 같이 둔다.
- 배포: 이 폴더에서 `npx vercel deploy --prod`
- 검색·AI 노출(2026-10-18):
  - `index.html`의 JSON-LD `Organization`(@id `https://watalabs.com/#organization`)을 맹고 페이지가 운영사로 가리킨다(`apps/web/lib/site.ts`의 `organizationJsonLd`). 이름·메일을 바꾸면 둘 다 바꾼다.
  - `og.png`: 링크 공유 카드(1200×630).
  - `llms.txt`: AI가 읽는 사이트 요약. 맹고 분야·요금·주요 페이지가 바뀌면 같이 고친다.
  - `<키>.txt`: IndexNow 키 파일. 배포 뒤 `pnpm indexnow`로 두 사이트맵 주소를 빙·네이버 등에 알린다(`scripts/indexnow.mjs`).
