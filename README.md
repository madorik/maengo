# 맹고

관심 분야 기술 소식을 매일 아침 읽고 듣는 웹앱. 직업은 받지 않고 관심사만으로 고른다. 전체 계획은 [PLAN.md](./PLAN.md), 필요한 키는 [API_KEYS.md](./API_KEYS.md).

## 구조

```
maengo/
├─ apps/web/        Next.js 16 웹앱(로그인, 오늘 피드, 듣기, 설정)
├─ packages/core/   웹과 파이프라인이 같이 쓰는 로직 — 토픽 사전, 랭킹, AI 모델 라우팅, 더미 AI, 오디오 챕터
└─ PLAN.md          기획·아키텍처·작업 순서
```

## 시작하기

```bash
pnpm install
pnpm dev          # http://localhost:3000 → 로그인 화면에서 아무 버튼이나 누르면 바로 들어간다
pnpm test         # 랭킹·모델 라우팅·더미 AI·플레이어 상태 머신 단위 테스트
pnpm typecheck
pnpm lint
pnpm build
```

## 지금 상태 (2026-10-09)

**디자인**: 듀오링고식(2026-10-09). 흰 바탕, 눌리는 3D 버튼, 망고 캐릭터(기본·축하·헤드폰), XP. 망고 노랑 = 주 행동, 잎 초록 = 완료, 하늘 파랑 = 듣기. 글꼴은 Pretendard + 숫자만 Nunito. 토큰은 `apps/web/app/globals.css`.

**된 것**
- 소개 페이지(`/`): 누구나 볼 수 있는 메인. 첫 화면, 기능 4가지(실제 화면 조각으로), 시작 3단계, 요금, 자주 묻는 질문, 시작 버튼(`components/landing/Landing.tsx`). 정적 페이지라 빠르게 뜨고, 로그인했으면 버튼만 브라우저에서 "오늘 맹고 열기"로 바뀐다(힌트 쿠키 `maengo_signed_in`). 앱 안의 망고 로고를 누르면 여기로 온다.
- SEO: 사이트 주소(`NEXT_PUBLIC_SITE_URL`), 제목·설명·키워드, OG·트위터 카드, 공유 이미지(`app/opengraph-image.tsx`), `robots.txt`(로그인 화면·API 막음), `sitemap.xml`, 구조화 데이터(WebSite·WebApplication·FAQPage), 로그인해야 보이는 화면은 noindex, 구글·네이버 소유 확인 메타(`lib/site.ts`, `app/layout.tsx`).
- 로그인 화면: Apple·Google 버튼. 지금은 데모 로그인이라 누르면 OAuth 없이 바로 `/today`로 들어간다.
- 오늘 목록(`/today`): 카드마다 카테고리, 제목, 요약, 출처(공식 문서·유튜브·기술블로그), 작성자, 작성일. 카드의 "듣기"로 그 글만 바로 듣는다. 하루 소식 수는 무료 1개, 플러스·체험 최대 10개이고, 무료면 "오늘 고른 소식이 N개 더 있어요" 안내가 붙는다.
- 오늘 맹고 전체 듣기: 오른쪽 아래에 챗봇처럼 떠 있는 버튼(`components/listen/ListenWidget.tsx`). 버튼에서 바로 재생·멈춤, 누르면 듣기 창(지금 소식, 진행, 이전·다음, 말투, 재생 목록, 자동 재생, 대본 보며 듣기)이 펼쳐진다. Esc나 접기로 닫는다. 오늘·보관함·설정 화면에 뜬다.
- 보관함(`/library`): 지금까지 받은 피드 전체를 날짜별로 묶어 10개씩 페이지로 보여 준다. 카테고리 칩으로 거른다(`?category=travel&page=2`). 지난 글도 상세로 열리고 그 글 하나만 들을 수 있다.
- 관심 토픽 고치기(설정 `#topics`): 내 토픽을 ×로 빼고, 문장이나 단어("쿠버네티스 운영이랑 보안")로 추가하거나 추천 토픽을 눌러 추가한다. 문장은 AI가 토픽 사전에서 최대 3개를 고르고(지금은 이름·별칭 맞추기, `packages/core/src/topics/match.ts`), 맞는 게 없으면 요청으로 남긴다. 토픽 수는 무료 5개·플러스 20개, 문장 추가는 하루 10번까지. 바꾼 내용은 다음 피드부터 반영된다.
- 카테고리 자동 분류: AI·테크·디자인·비즈니스·마케팅·커리어·경제·과학·여행·라이프·기타 중 하나(`packages/core/src/categories.ts`). 클러스터마다 한 번만 분류해 모두가 같이 쓴다. 지금은 키워드 분류기, 키가 들어오면 Gemini가 같은 목록에서 고른다.
- 상세(`/article/[id]`): 전체 글, 요약, "왜 중요한가"(망고 말풍선), 원문 링크(위쪽과 아래 출처 칸 두 군데), 유튜브면 썸네일과 짚은 장면. 아래 "이 글 듣기" 막대로 그 글을 듣고, 듣는 동안 지금 읽는 문단을 짚어 주며 따라 스크롤한다. 끝나면 "다음 글 듣기". 글을 열면 읽음으로 친다.
- 이어 듣기(`/listen`): `<audio>` 하나 + 챕터 seek. 대본이 말풍선으로 쌓이고(대담은 좌우), 이전·다음, 자동 재생, 읽은 소식 건너뛰기, 말투 3종·목소리 2종(재생 중에 바꿔도 같은 소식에서 이어짐), 재생 속도, 잠금 화면 버튼(Media Session). 화면을 옮겨도 재생이 끊기지 않고, 모바일은 아래에 듣는 중 막대가 뜬다.
- XP: 읽거나 들은 소식 10, 의견 5(`lib/gamify.ts`). 오늘 목표·연속 기록은 뺐다.
- 데모 계정은 어제까지 무료로 14일을 썼고(하루 1개, 보관함에 쌓여 있음) 오늘 체험을 시작한 상태다(`lib/server/store.ts`).
- 유튜브 썸네일: 주소에서 영상 ID를 뽑아 `i.ytimg.com` 썸네일을 쓴다(`packages/core/src/util/youtube.ts`). 데모 영상은 ID가 없어 썸네일을 그려서 보여 준다.
- 플랜별 AI 모델: 무료는 `GEMINI_MODEL_FREE`(Gemini Flash), 플러스·체험은 `GEMINI_MODEL_PLUS`(상위 모델). "왜 중요한가" 캐시도 등급별로 따로 둔다. 무료는 듣기가 잠긴다.
- 설정(`/settings`): 데모용 플랜 전환, 지금 쓰는 모델, 토픽 가중치, 피드 다시 고르기, 로그아웃.

**외부 서비스**(자세한 건 [API_KEYS.md](./API_KEYS.md))
- Supabase 프로젝트 `maengo`(서울)를 만들고 스키마·RLS·토픽 사전을 적용했다(`supabase/migrations/`, `pnpm db:push`). 키는 `apps/web/.env.local`에 있다. 앱 코드는 아직 메모리 저장소를 쓴다.
- 로그인 설정: `pnpm setup:auth`가 `.env.local`의 구글·애플 값으로 Supabase 로그인을 켠다. 애플 시크릿(6개월)은 `pnpm apple:secret`로도 만들 수 있다.
- 푸시는 Firebase Cloud Messaging(Android·iOS 앱, 웹), 앱은 Capacitor로 감싼다(PLAN.md 9.2·9.3). Firebase·구글·애플·Gemini는 직접 만들어야 한다.

**더미로 돌아가는 것**
- AI: `packages/core/src/ai/dummy.ts`. 문구는 미리 만든 데모 데이터, 음성은 실제 목소리 대신 항목마다 차임과 문장마다 짧은 신호음(WAV). 챕터·진행 막대·대본 하이라이트는 실제와 같은 방식으로 움직인다.
- 데이터: `apps/web/lib/server/store.ts` 메모리 저장소와 `demo-clusters.ts`의 소식 18개. 공식 문서 글은 실제 문서 주소와 발행처를 썼고, 나머지 블로그·채널·작성자는 예시(링크는 example.com)다. 개발 서버를 다시 켜면 처음 상태로 돌아간다.

**다음**
- Gemini 키를 받으면 `packages/core/src/ai/`에 Gemini 클라이언트를 붙이고 `apps/web/lib/server/ai.ts`에서 바꾼다.
- Supabase(스키마·Auth) → 온보딩 → 수집 파이프라인 → 알림 → 결제 순(PLAN.md 11장).
