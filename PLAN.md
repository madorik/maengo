# 맹고 개발 플랜

작성 2026-10-09. 2주 안에 "로그인 → 관심사 온보딩 → 매일 피드 → 페르소나 오디오 이어 듣기 → 정기결제"까지 혼자 만들어 런칭하기 위한 구현 계획이다.

- 기획: [2주 MVP 플랜](https://claude.ai/code/artifact/8f8c6640-8a73-47ec-aa74-f0c68dc4b3cd)
- 디자인: [맹고 웹앱 디자인 캔버스](https://claude.ai/artifact/NriZMyFA4XR2KWSxriD7Di)

---

## 1. 목표와 범위

2주 뒤 이 흐름이 사람 손 없이 매일 돌아야 한다.

1. 애플 또는 구글로 로그인한다.
2. 관심사(추천 토픽 + 문장) → 알림 시간 순서로 온보딩을 마치면, 10초 안에 첫 피드가 뜬다. **직업은 받지 않는다**(2026-10-09 결정). 어떤 직업이든 관심 있는 분야 소식만 고른다.
3. 매일 04:00 KST 배치가 수집·요약·랭킹·오디오를 끝내고, 유저가 고른 시각(06:30/07:00/08:00)에 FCM 푸시(Android·iOS 앱, 웹)나 이메일을 보낸다.
4. 무료 유저는 텍스트 카드를 읽고 피드백(더 보고 싶어요 / 이미 알아요 / 관심 없어요)을 남긴다.
5. 플러스(체험 포함) 유저는 "오늘 5개 이어 듣기"로 페르소나 오디오를 끝까지 듣고, 개인 팟캐스트 RSS와 주간 스터디 팩(PPTX·PDF)을 받는다.
6. 포트원 정기결제로 플러스에 가입하고 해지한다.

**범위 밖(v2)**: 카카오 로그인, GitHub 스택 온보딩, 공개 팟캐스트 자동 발행, 카드별 Q&A, 팀 플랜, 카카오 알림톡.

**지켜야 할 원칙**
- LLM·TTS 비용은 클러스터(같은 소식 묶음) 단위로 한 번만 쓴다. 유저 단계에서 LLM을 부르는 곳은 "왜 중요한가" 캐시 미스와 문장→토픽 매핑뿐이다.
- AI 모델은 플랜 등급으로 고른다. 무료는 Gemini Flash, 플러스·체험은 상위 모델이다(2026-10-09 결정). 요약과 why 캐시 키에 등급(`tier`)을 넣는다.
- 원문 본문은 저장하지 않는다. 요약·다시 쓴 전체 글·출처·링크만 남긴다. 상세 화면의 "전체 글"은 원문 복사가 아니라 AI가 우리 말로 다시 쓴 글이다(원문 전체를 그대로 보여 주려면 출처별 허락이 필요하다).
- 모든 배치 단계는 날짜 키로 멱등이어야 한다. 몇 번을 다시 돌려도 결과가 같다.

---

## 2. 아키텍처

```
                         ┌──────────────────────────── Vercel (Next.js 16) ───────────────────────────┐
[앱·웹·PWA] ──────────▶ │ 페이지 · Server Actions · Route Handlers                                    │
  웹 플레이어 ──┐        │ Vercel Cron: /api/cron/notify(30분마다) · /api/cron/billing(하루 1번)        │
               │        │ /podcast/[token] (개인 RSS)                                                  │
[팟캐스트 앱] ─┼──────▶ └───────┬───────────────┬────────────────┬───────────────┬──────────────────┘
               │                │               │                │               │
               │                ▼               ▼                ▼               ▼
               │        [Supabase]        [FCM/Resend]        [PortOne]   [GitHub dispatch]
               │        Postgres+pgvector                                       │
               │        Auth(Apple·Google)                                      ▼
               │                ▲                               ┌────── GitHub Actions ──────┐
               │                └───────────────────────────────│ daily.yml  04:00 KST        │
               │                                                │ assemble.yml (요청 시)       │
               ▼                                                └──┬──────────┬───────────┬──┘
        [Cloudflare R2] ◀── MP3 세그먼트·에피소드·스터디 팩 ─────────┘          │           │
                                                                          [Gemini API]   [검색 API]
                                                                          무료: Flash
                                                                          플러스: 상위 모델·TTS
```

| 구성 요소 | 맡는 일 | 고른 이유 |
| --- | --- | --- |
| Vercel (Next.js 16, React 19, Tailwind 4) | 웹앱, API, 알림·결제 크론, RSS | 우아주와 같은 스택. Hobby는 상업용 불가라 Pro |
| Supabase | Postgres + pgvector, Auth(Apple·Google), RLS | 벡터 검색과 소셜 로그인을 한곳에서 |
| GitHub Actions | 일일 배치, 에피소드 재조립 | 무료, ffmpeg 기본 설치, 실행 시간 제한이 넉넉함 |
| Cloudflare R2 | 오디오·스터디 팩 파일 | 송신 요금이 없어 오디오 다운로드가 늘어도 비용이 그대로 |
| Gemini API | 요약, "왜 중요한가", 페르소나 대본, 문장→토픽 매핑, 유튜브 URL 요약, 임베딩, TTS | 키 하나로 전부 처리. 플랜 등급마다 모델 이름만 바꾼다(무료 Flash, 플러스 상위 모델). 유튜브를 자막 크롤링 없이 공식 API로 처리 |

---

## 3. 저장소 구조

우아주와 같은 pnpm 모노레포다. 파이프라인과 웹이 같은 랭킹·피드 로직을 써야 해서 `packages/core`로 뺀다.

```
maengo/
├─ apps/web/                     Next.js 16 App Router
│  ├─ app/
│  │  ├─ (public)/page.tsx       랜딩
│  │  ├─ login/ auth/callback/
│  │  ├─ onboarding/             2단계 (관심사 → 알림)
│  │  ├─ today/ listen/ library/ settings/ plus/
│  │  ├─ podcast/[token]/route.ts
│  │  └─ api/…                   7장 표 참고
│  ├─ components/                FeedCard, ProgressSlots, FinishLine, ListenPanel, Queue,
│  │                             PersonaPicker, Switch, PlayAllCTA, OnboardingSteps …
│  ├─ lib/player/                플레이어 상태 머신(순수 함수) + <audio> 바인딩
│  ├─ public/firebase-messaging-sw.js(웹 FCM), manifest
│  └─ vercel.json                크론 정의
├─ pipeline/                     tsx로 도는 배치 (GitHub Actions에서 실행)
│  └─ src/
│     ├─ run-daily.ts            단계 순서대로 실행, --date --only --from 옵션
│     └─ jobs/ collect extract embed cluster tag score summarize rank why audio episode pack report
├─ packages/core/                웹과 파이프라인이 같이 쓰는 로직
│  └─ src/
│     ├─ topics/                 토픽 사전, 인기 토픽 순서, matchTopics(문장→토픽)
│     ├─ feed/                   rankFeed, buildFeedForUser
│     ├─ ai/                     models.ts(등급→모델), gemini.ts, dummy.ts, prompts/*.md, usage 기록
│     ├─ audio/                  personas, pronunciations.json, tts, encode, chapters
│     ├─ storage/r2.ts
│     └─ util/                   canonicalUrl, kst
├─ apps/mobile/                  Capacitor(iOS·Android) 껍데기. 배포된 웹을 띄우고 푸시·백그라운드 재생·애플 로그인을 붙인다(9.3)
├─ packages/db/                  supabase gen types 결과, zod 스키마
├─ supabase/
│  ├─ config.toml
│  └─ migrations/                20261009150000_init.sql(스키마·RLS), …_topics.sql(토픽 사전), …_lock_trigger_fn.sql — 적용됨
├─ scripts/                      supabase-auth.mjs(로그인 설정), apple-client-secret.mjs(6개월 시크릿)
└─ .github/workflows/ daily.yml assemble.yml ci.yml
```

**디자인은 듀오링고식으로 바꿨다(2026-10-09).** 디자인 캔버스(1차, 남색·형광펜·세리프)는 화면 구성 참고용으로만 남는다. 흰 바탕, 눌리는 3D 버튼, 망고 캐릭터, XP. 전체 듣기는 오른쪽 아래 떠 있는 버튼(챗봇형). 망고 노랑 `#FFC23D`(주 행동, 글자는 남색), 잎 초록 `#23914F`(완료), 하늘 파랑 `#1A8FE0`(듣기), 잉크 `#1F2340`. 글꼴은 Pretendard(npm 패키지, 글자 범위별 조각) + 숫자만 Nunito(`next/font/google`). 토큰은 `apps/web/app/globals.css`.

---

## 4. 데이터베이스 스키마

**기준은 `supabase/migrations/`다(2026-10-09 Supabase 프로젝트 `maengo`, 서울 리전에 적용).** 표 요약:

| 묶음 | 표 | 메모 |
| --- | --- | --- |
| 사용자 | profiles, user_topics, unmatched_interests | 가입하면 트리거가 profiles를 만든다(체험 7일). onboarded_at이 null이면 온보딩으로. 직업 칸은 없다 |
| 토픽 | topics(popularity = 추천 순서, embedding 768) | 사전 22개를 마이그레이션으로 넣었다 |
| 수집 | sources, clusters, items(hnsw 인덱스), cluster_topics | |
| 요약 캐시 | summaries(cluster, tier: 요약·전체 글·작성자·카테고리), cluster_why(cluster, topic, tier) | |
| 유저별 결과 | feeds(rank 1~10), feed_days(그날 보여 준 개수), feedback(바꾼 토픽·양), reads | 무료는 1개, 플러스는 10개를 보여 준다 |
| 오디오 | audio_segments(대본 jsonb: 줄·문단 번호), episodes(챕터 jsonb), packs | |
| 알림 | device_tokens(FCM 토큰, platform: android·ios·web), notifications_log | |
| 결제·운영 | subscriptions(store: portone·app_store·play), payments, usage_log | 앱 안 결제는 스토어 결제(9.3) |

**RLS 규칙**

| 테이블 | 클라이언트(로그인 유저) | 쓰는 쪽 |
| --- | --- | --- |
| profiles | 본인 행 select, update는 설정 칸(이름·알림 시각·말투·목소리·자동 재생·건너뛰기)만 | 가입 트리거가 insert. plan·trial은 서버만 |
| user_topics, feedback, reads, device_tokens | 본인 행 select·insert·update·delete | 웹·앱 |
| feeds, feed_days, episodes, packs | 본인 행 select | 파이프라인, 첫 피드 생성(service role) |
| topics, clusters, items, cluster_topics, summaries, cluster_why | 로그인 유저 전체 select | 파이프라인 |
| sources, unmatched_interests, audio_segments, subscriptions, payments, notifications_log, usage_log | 정책 없음(접근 불가) | service role 전용 |

Supabase 보안 점검(advisors): 경고 0건. INFO 7건은 위 마지막 줄 표들이 의도대로 정책이 없다는 안내다.

---

## 5. 인증과 온보딩

### 5.1 로그인 설정

**Google**
1. Google Cloud Console에서 OAuth 동의 화면을 만들고, 웹 OAuth 클라이언트를 발급한다.
2. 승인된 리디렉션 URI에 Supabase 콜백(`https://<project>.supabase.co/auth/v1/callback`)을 넣는다.
3. Supabase 대시보드에서 Google 공급자를 켜고 클라이언트 ID·시크릿을 넣는다.

**Apple** (Apple 개발자 멤버십 연 $99 필요)
1. Identifiers에서 App ID를 만들고 Sign in with Apple을 켠다.
2. Services ID(웹용)를 만들고, 도메인과 Return URL(Supabase 콜백)을 등록한다.
3. Keys에서 Sign in with Apple 키(.p8)를 받는다.
4. `scripts/apple-client-secret.ts`로 client secret(JWT)을 만들어 Supabase Apple 공급자에 넣는다. **이 시크릿은 최대 6개월이면 만료되므로 캘린더에 갱신 알림을 건다.**
5. "나의 이메일 가리기"를 쓴 유저에게 메일을 보내려면 Certificates, Identifiers & Profiles → Services → Sign in with Apple for Email Communication에 발신 도메인과 주소를 등록한다(SPF·DKIM 필요).
6. 이름은 첫 로그인 때만 온다. 없으면 온보딩 인사말에서 이름을 빼고 "반가워요."만 쓴다.

**Next.js 쪽**
- `@supabase/ssr`로 서버·브라우저 클라이언트를 만든다. middleware에서 세션을 갱신한다.
- `/auth/callback`에서 code를 세션으로 바꾼 뒤, profiles 행이 없으면 `/onboarding`, 있으면 `/today`로 보낸다.
- middleware 가드: 로그인 안 함 → `/login`, 프로필 없음 → `/onboarding`.

### 5.2 온보딩 저장

관심사 → 알림 2단계다(디자인 캔버스의 직업 단계는 뺀다). 상태는 클라이언트에 두고, 마지막에 서버 액션 한 번으로 저장한다.

```ts
completeOnboarding({
  topicIds,        // 고른 토픽(1개 이상)
  extraTopicIds,   // 문장에서 찾은 토픽
  notifyAt,        // '06:30' | '07:00' | '08:00'
}): Promise<{ redirect: '/today' }>
```

1. profiles upsert: notify_at, plan='trial', trial_ends_at=now()+7일
2. user_topics: 고른 토픽은 weight 1.0. 추천 토픽은 인기 순서(POPULAR_TOPICS)로 보여 주고, 최소 1개를 고르게 한다. 관심사가 좁아 피드가 모자라면 그날은 받은 만큼만 보여 준다.
3. `buildFeedForUser(userId, todayKst, { coldStart: true })`로 오늘 피드를 바로 만든다(5.4).
4. `/today`로 보낸다. 푸시 권한과 FCM 토큰 등록은 알림 단계의 "알림 받기" 버튼에서 따로 처리한다(9.2).

### 5.3 문장 → 토픽 매핑 (`POST /api/topics/map`)

- 입력: 유저 문장, 토픽 사전(id·이름·별칭).
- 유저 등급 모델의 structured output(JSON 스키마)으로 `{ topicIds: string[] }`(최대 3개, 사전에 있는 id만)를 받는다.
- 사전에 없는 관심사는 버리지 않고 `unmatched_interests` 로그로 남긴다. 토픽 사전을 늘릴 근거가 된다.
- 유저당 하루 10회로 제한한다.
- 설정의 관심 토픽 화면(구현됨, 데모): 내 토픽 빼기(×, 하나는 남김), 문장으로 추가(이 API), 추천 토픽 추가(인기 순서). 고른 토픽 가중치는 1.0, 토픽 수는 entitlements.topicLimit(무료 5, 플러스 20)까지.

### 5.4 첫 피드 즉시 생성

- 후보: 최근 48시간 안에 요약이 끝난 클러스터. 서비스 첫 주처럼 부족하면 7일까지 넓힌다.
- 랭킹은 6.3의 `rankFeed`를 그대로 쓴다.
- "왜 중요한가" 문구는 (cluster, topic, tier) 캐시에서 찾는다. 직업을 받지 않으니 같은 소식·토픽이면 모두가 같은 문구를 쓴다. 없는 것만 모아 유저 등급 모델 호출 한 번으로 만든다(동기 호출, 목표 5초).
- 그동안 `/onboarding`은 "첫 피드 고르는 중" 화면을 보여준다. 10초가 넘으면 why 없이 카드부터 보여주고, 문구는 나중에 채운다.

---

## 6. 일일 파이프라인

### 6.0 구현 상태 (2026-10-09)

`pipeline/`에 collect → embed → cluster → tag → summarize → dedupe → rank까지 구현했고, 실제 Supabase에 한 번 돌렸다. 오디오·에피소드·팩·리포트 단계는 아직이다(오디오는 사용자가 요청할 때 만들기로 바꿈).

- **수집**: 출처 43곳(`pipeline/src/sources.ts`, 국내 매체·기술 블로그 15, 해외 25, 유튜브 2). 봇을 막는 곳은 우회하지 않고 뺐다. 첫 실행에 72시간 창에서 글 391개
- **임베딩**: 제목 + RSS 설명만(본문은 요약할 때만 읽는다). `gemini-embedding-001` 768차원
- **묶기**: 중심 벡터 코사인 ≥ 0.82, 같은 출처끼리는 묶지 않는다(실측으로 0.88에서 내림)
- **태그**: 토픽 벡터와 비교한 1차 거름망. 1순위와 0.04 안쪽 토픽만, 코사인 0.55~0.70 → 관련도 0~1
- **요약**: 유저 관심사로 미리 랭킹해 피드에 들어갈 만한 묶음만 요약한다. 호출 한 번에 제목·요약·전체 글·카테고리·토픽·토픽별 why. 실행당 상한 `PIPELINE_SUMMARIZE_LIMIT`
- **중복 합치기**: 원문 임베딩으로 못 묶은 한·영 같은 소식을 한국어 요약 벡터(≥ 0.86)로 찾아 합친다
- **랭킹**: 요약된 묶음만 후보. 웹이 배치 전에 만든 임시 피드(`feed_days.built_by='web'`)는 다시 만든다
- **웹**: 메모리 데모를 걷어 내고 Supabase를 읽는다(service role + user_id 조건, 실제 로그인 붙으면 RLS 클라이언트로). 웹은 LLM을 부르지 않는다

배포(2026-10-10): 웹은 Vercel(https://maengo.vercel.app, 서울 리전), 로그인은 구글(Supabase Auth) + 처음 들어오면 관심사 고르기. 공개 배포에서는 데모 로그인·데모 도구를 끈다.

### 6.1 실행

- GitHub Actions `daily.yml`, `cron: '0 19 * * *'`(UTC) = 매일 04:00 KST. Actions 예약 실행은 붐빌 때 늦어질 수 있어 첫 알림(06:30)까지 2시간 반의 여유를 둔다.
- `concurrency: daily`로 중복 실행을 막는다.
- 진입점: `pnpm --filter pipeline daily --date=2026-10-20 [--only=summarize] [--from=rank]`
- 모든 단계는 "이미 있으면 건너뜀"으로 멱등하다. 실패하면 `--from`으로 그 단계부터 다시 돌린다.
- 기사 본문은 실행 중 임시 디렉터리(`$RUNNER_TEMP/text/{itemId}.txt`)에만 두고, 실행이 끝나면 지운다.

### 6.2 단계

| # | 단계 | 입력 → 출력 | 외부 호출 | 건너뛰는 조건 |
| --- | --- | --- | --- | --- |
| 1 | collect | sources → 새 items | RSS, 유튜브 채널 RSS, HN API, dev.to API, 검색 API(토픽당 1쿼리) | canonical_url 중복 |
| 2 | extract | 기사 URL → 본문(임시 파일) | fetch + @mozilla/readability | 영상은 건너뜀 |
| 3 | embed | 제목 + 본문 앞 2,000자 → vector(768) | Gemini 임베딩 | embedding이 이미 있음 |
| 4 | cluster | 72시간 창, 코사인 ≥ 0.88이면 기존 클러스터, 아니면 새 클러스터 | — | cluster_id가 이미 있음 |
| 5 | tag | 클러스터 임베딩(구성 아이템 평균) vs 토픽 임베딩, 상위 3개 중 ≥ 0.55 | — | upsert |
| 6 | score | 신선도·출처 가중치·클러스터 크기 → clusters.score | — | — |
| 7 | summarize | basic: 점수 상위 200개 / pro: 플러스·체험 유저 후보 상위분 → summaries. 같은 호출에서 카테고리(AI·테크·여행 등 11종 중 하나)도 고른다 | Gemini Batch(기사), Gemini 유튜브 URL(영상). 등급별 모델, 카테고리는 enum structured output | (cluster, tier) 요약이 이미 있음 |
| 8 | rank | 모든 유저 → feeds(오늘). 하루 소식 수는 무료 1개, 플러스·체험 최대 10개 | — | (user, date)가 이미 있음 |
| 9 | why | 오늘 feeds의 (cluster, topic, tier) 중 캐시 없는 것 → cluster_why | Gemini Batch, 유저 등급 모델 | 캐시 있음 |
| 10 | audio | 플러스·체험 유저 피드의 (cluster, persona, voice) 중 없는 것 → 대본 → TTS → MP3 → R2 | Gemini 상위 모델(대본), Gemini TTS, ffmpeg | 세그먼트 있음 |
| 11 | episode | 플러스·체험 유저별 오늘 에피소드 1개 | ffmpeg | 에피소드 있음 |
| 12 | pack | (일요일만) 별표 항목 → Marp → PPTX·PDF → R2 | Marp CLI | 이번 주 팩 있음 |
| 13 | report | 건수·실패·비용 → 텔레그램 또는 슬랙 | 웹훅 | — |

### 6.3 랭킹 공식 (`packages/core/feed/rankFeed.ts`)

```
relevance(u, c) = Σ_t  w(u, t) · rel(c, t)             # 유저 토픽 가중치 × 클러스터-토픽 관련도
base(c)         = freshness(c) · sourceWeight(c) · (1 + 0.3 · ln(size(c)))
freshness(c)    = exp(-ageHours(c) / 36)
score(u, c)     = relevance(u, c) · base(c)

제외: 이미 읽거나 들은 클러스터, known·skip 피드백을 준 클러스터, 그와 코사인 ≥ 0.9인 클러스터(7일)
선택: 점수순으로 고르되 같은 토픽 최대 2개, 영상 최대 2개 → 5개
대표 토픽: 그 클러스터에서 w(u,t)·rel(c,t)가 가장 큰 토픽 → feeds.topic_id (why 문구 선택용)
```

피드백 반영: more → w+0.1(최대 1.5), skip → w−0.15(최소 0.1), known → 가중치는 그대로 두고 비슷한 클러스터만 제외한다.

### 6.4 LLM 호출 규칙

**모델 고르기** (`packages/core/src/ai/models.ts`, 구현됨)
- `tierOf(plan)`: free → `basic`, trial·plus → `pro`. `modelFor(tier)`는 env `GEMINI_MODEL_FREE`(기본 `gemini-flash-latest`)와 `GEMINI_MODEL_PLUS`(기본 `gemini-pro-latest`)를 읽는다.
- 유저 단계 호출(why 캐시 미스, 문장→토픽)은 그 유저의 등급 모델을 쓴다. 오디오 대본은 플러스 전용이라 늘 `pro`다.
- 요약과 why는 등급마다 따로 캐시한다. 같은 소식이라도 무료와 플러스의 문구가 다를 수 있다.

**Gemini** (`packages/core/src/ai/gemini.ts`, 키를 받으면 작성)
- 일일 배치(summarize·why·대본)는 Batch API로 보내고 결과는 요청 키(clusterId 등)로 맞춘다.
- 출력은 JSON 스키마(structured output)로 고정한다. 차단·빈 응답이면 그 클러스터를 건너뛰고 report에 남긴다.
- 고정된 시스템 프롬프트(요약 규칙·형식 예시)를 맨 앞에 두고 컨텍스트 캐시를 쓴다.
- 유튜브: 공개 영상 URL을 `file_data`로 넣는다. 미디어 해상도를 낮게 잡아 토큰을 줄이고, 60분이 넘는 영상은 건너뛴다. 출력은 `{ title, short, detail, scenes[] }` JSON이다.
- 임베딩: 768차원으로 받는다(13장 4번).
- TTS: env `GEMINI_TTS_MODEL`. 출력이 PCM 24kHz라 ffmpeg로 MP3로 바꾼다(8.1).
- **비용**: pro 요약은 플러스 유저 피드에 들어갈 후보만 만든다. 등급별 하루 비용은 Day 5에 30건으로 실측한다(13장 1번).

**지금은 더미** (`packages/core/src/ai/dummy.ts`): 같은 `AiClient` 인터페이스로 미리 만든 문구와 차임·신호음 WAV를 돌려준다. 웹은 `apps/web/lib/server/ai.ts` 한 곳에서 구현을 고른다.

모든 호출은 `usage_log`에 토큰·초·추정 비용을 남긴다.

---

## 7. 웹앱 라우트와 API

**페이지**

| 경로 | 화면 (디자인 캔버스) | 접근 |
| --- | --- | --- |
| `/` | 소개 페이지: 첫 화면, 기능 4가지(실제 화면 조각), 시작 3단계, 요금, 시작 버튼 | 누구나. 로그인 상태면 버튼이 "오늘 맹고 열기"로 바뀐다 |
| `/login` | 로그인 · 모바일 | 비로그인 |
| `/onboarding` | 시작하기 1·2·3 | 로그인, 프로필 없음 |
| `/today` | 오늘 목록: 카테고리·제목·요약·출처·작성자·작성일, 카드별 듣기. 전체 듣기는 오른쪽 아래 떠 있는 버튼 | 로그인 |
| `/article/[id]` | 상세: 전체 글, 원문 링크, 유튜브 썸네일, "이 글 듣기"(읽는 문단 표시), 의견 3종 | 로그인 |
| `/listen` | 이어 듣기(대본 말풍선) | 플러스·체험 |
| `/library` | 보관함: 지금까지 받은 피드 전체를 날짜별로, 카테고리 필터, 10개씩 페이지(`?page=&category=`). 스터디 팩은 Day 12 | 로그인 |
| `/settings` | 관심 토픽·알림 시간·말투·알림 받기·팟캐스트 주소·구독 | 로그인 |
| `/plus` | 플러스 가입·결제 | 로그인 |
| `/podcast/[token]` | 개인 팟캐스트 RSS(XML) | 토큰 |

**API (Route Handlers)**

| 메서드 · 경로 | 하는 일 | 부르는 쪽 |
| --- | --- | --- |
| `POST /api/topics/map` | 문장 → 토픽 id | 온보딩 2단계, 설정 |
| `POST /api/feedback` | `{clusterId, kind}` 저장, 토픽 가중치 갱신 | 카드 버튼 |
| `POST /api/reads` | `{clusterId, read?, listened?, starred?}` | 카드 펼치기, 플레이어 챕터 진입, 별표 |
| `POST /api/devices` · `DELETE` | FCM 토큰 등록·삭제 `{token, platform, appVersion}` | 앱 시작, 온보딩 알림 단계, 설정 |
| `GET /api/episode/today` | `{url, chapters}` 또는 에피소드가 없을 때 `{segments[]}` | 플레이어 |
| `POST /api/audio/request` | 말투·목소리 변경 시 assemble.yml 트리거 | 설정, 듣기 화면 |
| `POST /api/billing/issue` | 빌링키로 첫 결제, 구독 생성 | `/plus` |
| `POST /api/billing/cancel` | 기간 끝 해지 | 설정 |
| `POST /api/billing/webhook` | 포트원 결제 상태 동기화(서명 검증) | 포트원 |
| `GET /api/cron/notify` | 알림 발송(9.2) | Vercel Cron, `*/30 * * * *` |
| `GET /api/cron/billing` | 갱신 결제·재시도·체험 만료 | Vercel Cron, 하루 1번 |

크론 경로는 `Authorization: Bearer ${CRON_SECRET}`을 확인한다. 온보딩 저장과 설정 변경은 Server Actions로 처리한다.

---

## 8. 오디오와 이어 듣기

### 8.0 구현 상태 (2026-10-09)

배치에서 미리 만들지 않고 **사용자가 재생을 누를 때** 만든다(비용은 실제로 들은 소식만큼).

- 대본: LLM 없이 템플릿(`packages/core/src/ai/script.ts`). 요약 본문을 그대로 읽고 앞뒤 연결 문장만 붙인다. 순서 문장("세 번째 소식")은 빼서 같은 소식·토픽·말투면 누구나 같은 음성을 쓴다
- 음성: Gemini TTS `gemini-3.8-flash-tts`, 목소리 Kore(여)·Charon(남), 대담은 화자 2명 한 번에. 말투는 본문 앞 지시문으로(소리로 읽지 않음, 받아쓰기로 확인)
- 저장: 대본 내용 해시가 키. MP3(모노 48kbps CBR, 순수 JS 인코더)로 R2 `audio/seg/<key>.mp3`, 줄별 시각은 `audio_segments`. 오늘 전체 듣기는 세그먼트를 바이트 그대로 이어 붙인 `audio/ep/<hash>.mp3`(처음 열 때 만듦). 버킷은 비공개, 서버가 302로 서명 URL(6시간, 1시간 단위로 같은 주소)을 넘기면 `<audio>`가 R2에서 Range로 받는다. R2 키가 없거나 `AUDIO_STORE=local`이면 로컬 디스크. 같은 세그먼트를 동시에 요청하면 한 번만 만든다, 동시 생성 3개
- 화면: 페이지를 열 때는 만든 음성만 미리 받는다. 목록 카드·상세의 "듣기"는 그 소식 하나만, "오늘 맹고 전체 듣기"는 오늘 소식 전부를 만든다(이미 만든 것은 다시 안 만듦). 만드는 동안 "음성을 만드는 중" 표시
- 실측: 86초 음성에 42초, 75초에 28초, 84초에 30초. 소식 하나 약 $0.02(2.5 Flash TTS 단가 기준 추정, 무료 등급이라 실제 0)
- 크기: 소식 하나 약 530KB(WAV 4.3MB → MP3)
- 남은 것: 서버리스 배포 시 긴 요청(생성 30~40초) 처리

### 8.1 세그먼트 만들기 (audio 단계)

1. 대본: 페르소나별 프롬프트(`prompts/script-announcer.md`, `script-teacher.md`, `script-dialogue.md`)에 요약·why를 넣어 상위 모델로 만든다. 대담은 `진행자:` / `해설자:` 줄로 받는다.
2. 발음 사전: `audio/pronunciations.json`(예: `LLM → 엘엘엠`, `Next.js → 넥스트 제이에스`)을 대본에 적용한다. 화면 텍스트에는 적용하지 않는다.
3. TTS: Gemini TTS. 1인 페르소나는 보이스 1개에 스타일 지시를 붙이고, 대담은 2인 화자 설정을 쓴다.
4. 인코딩: 모든 파일을 같은 설정으로 만든다. 그래야 8.2에서 재인코딩 없이 이어 붙일 수 있다.
   `ffmpeg -f s16le -ar 24000 -ac 1 -i in.pcm -codec:a libmp3lame -b:a 64k -ar 24000 -ac 1 out.mp3`
5. 저장: `seg/{clusterId}/{persona}-{voice}-v{n}.mp3`. 인트로·아웃트로는 페르소나·목소리별로 한 번만 만들어 `seg/_intro/…`에 둔다.

### 8.2 에피소드 조립 (episode 단계, assemble.yml)

- 유저별로 `인트로 + 세그먼트 5개 + 아웃트로`를 ffmpeg concat demuxer + `-c copy`로 붙인다. 재인코딩이 없어서 빠르다.
- 챕터는 ffmetadata로 넣어 MP3에 ID3 챕터를 쓰고, 같은 정보를 `episodes.chapters` JSON에도 저장한다.
- 경로: `ep/{podcastToken}/{date}-{persona}-{voice}.mp3`(공개 버킷, 추측 불가 경로).
- assemble.yml은 `workflow_dispatch`(입력: userId, date, persona, voice)로 웹에서 부른다. 말투를 낮에 바꾼 경우용이다.

### 8.3 웹 플레이어 — "오늘 5개 이어 듣기"

**`<audio>` 하나에 에피소드 파일 하나만 재생한다.** 파일을 바꿔 끼우지 않으니, 첫 탭 한 번 이후 iOS 백그라운드·잠금 화면에서도 끝까지 이어진다(브라우저 자동재생 정책상 첫 재생에는 탭이 꼭 필요하다).

플레이어 상태는 `lib/player/machine.ts`의 순수 함수로 만들고 단위 테스트한다.

| 동작 | 구현 |
| --- | --- |
| 이어 듣기 시작 | 시작 위치 = 첫 챕터. "읽은 항목 건너뛰기"가 켜져 있으면 첫 미읽음 챕터 |
| 이전 / 다음 | 해당 챕터 `startMs`로 seek |
| 다음 항목 자동 재생 끔 | `timeupdate`가 현재 챕터 `endMs`를 넘으면 pause |
| 읽은 항목 건너뛰기 켬 | 재생 중 읽은 챕터에 들어서면 다음 챕터로 seek |
| 진행 막대 | 챕터 길이 비율로 나눈 칸. 지난 칸은 채우고 현재 칸은 형광펜 색 |
| 들음 기록 | 챕터에 들어설 때 `POST /api/reads {listened: true}` |
| 잠금 화면 | Media Session: 제목은 현재 챕터, nexttrack·previoustrack = 챕터 이동, seekbackward = 15초 |
| 끝 | 마지막 챕터가 끝나면 "오늘은 여기까지예요" 화면 |
| 에피소드 없음 | 세그먼트 플레이리스트 모드로 같은 UI를 쓰고, `/api/audio/request`로 재조립 요청 |

### 8.4 개인 팟캐스트 RSS (`/podcast/[token]`)

- RSS 2.0 + iTunes 태그. 디렉터리에 노출되지 않게 `<itunes:block>Yes</itunes:block>`를 단다.
- 유저 기본 말투로 만든 최근 7개 에피소드를 넣는다. `enclosure`에 길이(bytes)와 `audio/mpeg`, `guid`는 날짜다.
- R2 공개 버킷의 Range 요청으로 애플 팟캐스트·Pocket Casts에서 재생되는지 Day 11에 확인한다.
- 설정에서 주소를 복사하고, 토큰을 재발급할 수 있다(옛 주소는 바로 끊김).

---

## 9. 결제와 알림

### 9.1 포트원 정기결제

1. `/plus`에서 포트원 브라우저 SDK로 빌링키를 발급받는다(PG사는 13장 6번).
2. `POST /api/billing/issue`: 서버가 빌링키로 첫 달(₩4,900)을 결제한다. `payments.id`(우리가 만든 paymentId)가 멱등 키다. 성공하면 subscriptions를 active로, profiles.plan을 plus로, current_period_end를 +1개월로 바꾼다.
3. `/api/cron/billing`(매일 09:00 KST): current_period_end가 지난 active 구독을 빌링키로 결제한다. 실패하면 past_due로 두고 3일간 하루 1번 재시도한 뒤 plan을 free로 바꾼다.
4. 웹훅: 서명을 검증하고 payments·subscriptions를 맞춘다. 같은 이벤트가 두 번 와도 결과가 같아야 한다.
5. 해지: `cancel_at_period_end=true`. 기간이 끝나면 free로 바꾼다.
6. 체험: 가입하면 7일 trial. 만료 시 빌링키가 없으면 free로 바꾼다.
7. 권한은 `entitlements(profile)` 한 곳에서 판단한다. → `{ audio, podcast, pack, topicLimit, dailyItems }`. dailyItems는 무료 1, 플러스·체험 10이다.

포트원 V2 API의 정확한 엔드포인트와 SDK 함수 이름은 Day 13에 공식 문서로 확인한 뒤 쓴다.

### 9.2 알림 — Firebase Cloud Messaging

Android·iOS 앱과 웹(PWA)을 모두 FCM 하나로 보낸다. 서버는 `firebase-admin`(서비스 계정)으로 토큰에 보낸다.

**토큰 받기**
- Android 앱: Capacitor + `@capacitor-firebase/messaging`. 권한을 받으면 FCM 토큰을 `/api/devices`에 `platform: 'android'`로 등록한다.
- iOS 앱: 같은 플러그인. 애플 개발자 계정의 APNs 인증 키(.p8)를 Firebase에 올려야 FCM이 iOS로 전달한다. `platform: 'ios'`.
- 웹: Firebase JS SDK `getToken(messaging, { vapidKey })` + `public/firebase-messaging-sw.js`. iOS 사파리는 홈 화면에 설치한 PWA에서만 된다. 앱을 쓰는 사람에게는 웹 토큰을 받지 않는다.
- 권한 요청은 온보딩 알림 단계의 "알림 받기" 버튼(사용자 동작)에서만 한다. 거절하면 이메일로 보낸다.
- 앱을 열 때마다 토큰을 다시 등록해 `last_seen_at`을 갱신한다(토큰은 바뀔 수 있다).

**보내는 내용**
- 제목 "오늘의 맹고가 도착했어요", 본문은 1번 소식 제목. 데이터 `{ url: '/today?from=push' }`로 누르면 오늘 화면을 연다.
- 플러스는 "오늘 10개, 선생님 말투로 약 11분" 같은 듣기 안내를 붙인다.

**발송 (`/api/cron/notify`, 30분마다)**
1. 지금 KST 슬롯(06:30/07:00/08:00)과 notify_at이 같고, `notifications_log`에 오늘 기록이 없는 유저를 고른다.
2. 오늘 feeds가 있으면 보낸다. 배치가 실패해 없으면, 전날 노출되지 않은 클러스터로 대체 피드를 만든 뒤 보낸다.
3. 유저의 모든 `device_tokens`로 `sendEachForMulticast`. `registration-token-not-registered`·`invalid-argument`로 돌아온 토큰은 지운다. 토큰이 하나도 없으면 Resend로 메일을 보낸다.
4. 보낸 기록을 `notifications_log`에 남겨 같은 날 두 번 보내지 않게 한다.

### 9.3 앱(Android·iOS)

- **방식**: Capacitor 껍데기 앱이 배포된 웹(`server.url`)을 띄운다. 서버 컴포넌트·Server Actions를 쓰므로 정적 export로 앱에 넣지 않는다.
- **앱에서만 붙이는 것**: FCM 푸시, 백그라운드 오디오(iOS `UIBackgroundModes: audio`, 잠금 화면 조작), 애플·구글 로그인 네이티브 창(Supabase `signInWithIdToken`), 딥링크(`APP_URL_SCHEME://auth/callback`, 푸시 눌렀을 때).
- **번들 ID·패키지명**: 기본안 `kr.maengo.app`(13장 10번). 애플 App ID, Firebase 앱, 플레이 콘솔에 같은 값을 쓴다. 정하면 못 바꾸니 등록 전에 확정한다.
- **스토어 정책**
  - 애플 4.2(최소 기능): 웹을 감싸기만 한 앱은 거절될 수 있다. 푸시, 백그라운드 이어 듣기, 오프라인 에피소드 저장으로 앱다운 기능을 갖춘다.
  - 애플 4.8: 구글 로그인을 넣으면 애플 로그인도 있어야 한다(이미 있음).
  - 앱 안에서 플러스(디지털 구독)를 팔면 애플 인앱 결제·구글 플레이 결제를 써야 한다. 한국에서는 두 스토어 모두 대체 결제를 허용하지만 수수료가 붙는다. 웹 결제(포트원)와 같은 계정 권한을 공유하도록 `subscriptions.store`로 구분한다(13장 9번).
- **음성**: 앱에서는 백그라운드 재생이 안정적이라 웹 PWA보다 이어 듣기 경험이 좋다. 팟캐스트 RSS는 그대로 둔다.

---

## 10. 환경 변수와 외부 계정

| 변수 | 쓰는 곳 | 용도 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | 클라이언트 |
| `SUPABASE_SERVICE_ROLE_KEY` | web(서버), pipeline | RLS를 우회하는 쓰기 |
| `GEMINI_API_KEY` | web(서버), pipeline | 모든 AI 호출 |
| `GEMINI_MODEL_FREE`, `GEMINI_MODEL_PLUS` | web(서버), pipeline | 등급별 요약·why·대본·토픽 매핑 모델 |
| `GEMINI_EMBED_MODEL`, `GEMINI_TTS_MODEL` | pipeline | 임베딩·TTS |
| `SEARCH_API_KEY` | pipeline | 오픈 웹 검색 |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL` | web, pipeline | 파일 |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `…_AUTH_DOMAIN`, `…_PROJECT_ID`, `…_MESSAGING_SENDER_ID`, `…_APP_ID`, `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | web(브라우저) | 웹 FCM 토큰 받기 |
| `FIREBASE_SERVICE_ACCOUNT_PATH` 또는 `FIREBASE_SERVICE_ACCOUNT_JSON` | web(서버) | 푸시 보내기(firebase-admin) |
| `APP_URL_SCHEME`, `APPLE_BUNDLE_ID`, `ANDROID_PACKAGE` | web, mobile | 앱 딥링크·네이티브 로그인 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_SERVICES_ID`, `APPLE_PRIVATE_KEY_PATH` | scripts | `pnpm setup:auth`가 Supabase 로그인 설정에 넣는다(앱 런타임에는 안 쓴다) |
| `RESEND_API_KEY`, `MAIL_FROM` | web | 이메일 |
| `PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`, `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET` | web | 결제 |
| `CRON_SECRET` | web | Vercel Cron 인증 |
| `GITHUB_DISPATCH_TOKEN` | web | assemble.yml 트리거(fine-grained PAT, actions 쓰기만) |
| `ALERT_WEBHOOK_URL`, `DAILY_USD_CAP` | pipeline | 실패·리포트 알림, 일일 비용 상한 |

애플·구글 OAuth 값은 `.env.local`에만 두고 `pnpm setup:auth`로 Supabase에 넣는다. 애플 시크릿은 6개월마다 이 명령으로 다시 만든다.

**외부 계정 (Day 1에 한꺼번에 신청. 오래 걸리는 것부터)**

| 계정 | 걸리는 시간 | 메모 |
| --- | --- | --- |
| 포트원 + PG 심사 | 1~2주 | 사업자등록·통신판매업 신고가 먼저 필요 |
| Apple 개발자 멤버십 | 개인은 수일. 법인은 D-U-N-S 번호부터 | 연 $99. 애플 로그인, APNs 키(푸시), 앱스토어 배포에 모두 필요 |
| Google Play 콘솔 | 즉시~수일(신원 확인) | 1회 $25. 개인 계정은 출시 전 테스터 비공개 테스트 조건이 있다 |
| Firebase | 즉시 | 무료(Spark). FCM만 쓴다 |
| 도메인 maengo.kr (maengo.com은 이미 등록됨) | 즉시 | 상표(KIPRIS)도 같이 확인 |
| Google Cloud OAuth | 즉시. 동의 화면 검수는 별도 | 기본 스코프(email·profile)만 |
| Supabase | 완료(2026-10-09) | 프로젝트 `maengo`(ref dplqcugmgrugfrzjylqw, 서울, 무료), 스키마·RLS·토픽 적용, 로그인 주소 설정 |
| Vercel Pro, Cloudflare R2, Resend(도메인 DNS) | 즉시 | |
| Google AI Studio 유료 결제, 검색 API | 즉시 | Gemini 유료 티어여야 유튜브 길이 제한이 없고, 입력이 제품 개선에 쓰이지 않음 |
| 텔레그램 봇 또는 슬랙 웹훅 | 즉시 | 실패·리포트 알림 |

---

## 11. 작업 순서

하루 4~6시간 기준이다. 평일 저녁에만 한다면 4주로 늘어난다.

### 1주차 — 무료 텍스트 피드

**Day 1 기반**
- [ ] pnpm 모노레포 생성(apps/web, pipeline, packages/core, packages/db), TypeScript·ESLint·vitest 공통 설정, ci.yml
- [ ] Supabase 프로젝트, 0001 마이그레이션, `supabase gen types` → packages/db
- [ ] Vercel 프로젝트, R2 버킷 2개(공개·비공개)와 수명 주기 규칙
- [ ] 외부 계정 신청(10장 표)
- 완료 기준: `pnpm dev`로 빈 페이지가 뜨고, 마이그레이션이 DB에 적용돼 있다

**Day 2 로그인**
- [ ] Google OAuth, Apple Services ID·키, `scripts/apple-client-secret.ts`
- [ ] Supabase Auth 공급자 설정, `/login`, `/auth/callback`, middleware 가드
- [ ] 토픽 50개 시드(인기 순서 포함), 토픽 임베딩 스크립트
- 완료 기준: 애플·구글 계정으로 각각 로그인하면 `/onboarding`으로 간다

**Day 3 온보딩·수집**
- [ ] `/onboarding` 3단계 UI(캔버스 그대로), `completeOnboarding`, `/api/topics/map`
- [ ] collect 단계: RSS·유튜브 채널 RSS·HN·dev.to·검색 API, sources 시드(블로그 30, 채널 20)
- 완료 기준: 온보딩 결과가 profiles·user_topics에 저장되고, collect 한 번에 items가 수백 건 쌓인다

**Day 4 정리 단계**
- [ ] extract, embed, cluster, tag, score
- [ ] 단위 테스트: canonicalUrl, clusterAssign
- 완료 기준: 하루치 클러스터와 토픽 태그가 생긴다. 중복 묶기 샘플 20건을 눈으로 확인한다

**Day 5 요약**
- [ ] summarize: 기사는 Gemini Batch, 영상은 Gemini 유튜브 URL, 등급별 모델, structured output, 차단 응답 처리
- [ ] why 단계
- [ ] 고정 샘플 30건으로 모델·프롬프트를 비교하고 13장 1번을 정한다
- 완료 기준: 점수 상위 클러스터가 전부 요약되고, usage_log에 비용이 남는다

**Day 6 피드**
- [ ] `rankFeed`, `buildFeedForUser`(packages/core), rank 단계, 단위 테스트(다양성·피드백·콜드스타트)
- [ ] 온보딩 직후 첫 피드 즉시 생성 + "첫 피드 고르는 중" 화면
- [ ] `/today`: 카드, 자세히, 피드백 3종, 5칸 진행 막대, "오늘은 여기까지예요" 블록
- 완료 기준: 새 계정이 온보딩을 마치면 10초 안에 카드 5개가 보인다

**Day 7 보관함·알림·배치**
- [x] `/library`(날짜별, 카테고리 필터, 페이지) — 데모 데이터로 구현됨. 남은 것: 별표, Supabase 조회
- [ ] FCM: `/api/devices`, 웹 `firebase-messaging-sw.js`·토큰 등록, firebase-admin 발송, Resend 메일, `/api/cron/notify`, vercel.json 크론
- [ ] daily.yml과 실패 알림
- 완료 기준: 다음 날 아침 설정한 시각에 푸시나 메일이 온다. 이날부터 직접 써 본다

### 2주차 — 오디오, 스터디 팩, 결제

**Day 8 오디오 세그먼트**
- [ ] 페르소나 대본 프롬프트 3종, 발음 사전
- [ ] Gemini TTS → ffmpeg MP3 → R2, audio 단계
- 완료 기준: 클러스터 1개로 페르소나 3종 × 목소리 2종 음성 파일이 나온다

**Day 9 에피소드**
- [ ] episode 단계(concat, 챕터, episodes 행), assemble.yml
- 완료 기준: 테스트 유저의 오늘 에피소드 1개(약 8분, 챕터 5개)가 R2에 있다

**Day 10 이어 듣기 플레이어**
- [ ] 플레이어 상태 머신과 단위 테스트(챕터 이동, 자동 재생 끔, 읽은 항목 건너뛰기)
- [ ] `/today` 듣기 패널, `/listen`, Media Session, 스위치 2개, 재생 목록, 끝 화면
- [ ] Capacitor 앱(iOS·Android) 껍데기: FCM 토큰, 백그라운드 오디오, 딥링크, 네이티브 애플·구글 로그인. 실기기 확인
- 완료 기준: 버튼 한 번으로 잠금 상태에서도 5개가 끝까지 재생된다

**Day 11 팟캐스트·설정**
- [ ] `/podcast/[token]` RSS, 주소 복사·재발급
- [ ] `/settings`: 토픽(구현됨)·알림 시간·말투 변경, 말투를 바꾸면 `/api/audio/request`
- 완료 기준: 애플 팟캐스트와 Pocket Casts에 등록해 재생되고, 카플레이에서도 나온다

**Day 12 스터디 팩**
- [ ] pack 단계(Marp 템플릿), 보관함 다운로드 버튼
- 완료 기준: PPTX·PDF가 열리고, 별표한 항목이 한 장씩 들어 있다

**Day 13 결제**
- [ ] `/plus`, 빌링키 발급, `/api/billing/issue`·`cancel`·`webhook`, `/api/cron/billing`, `entitlements`
- [x] 랜딩 페이지(소개 `/`) — 이용약관·개인정보 처리방침 페이지는 남음
- 완료 기준: 테스트 결제를 하면 plus로 바뀌어 오디오가 열린다. 해지하면 기간이 끝날 때 free로 돌아간다

**Day 14 운영·런칭**
- [ ] 비용 가드, 일일 리포트, 보존 정책, Sentry(웹)
- [ ] 버그 수정, 런칭 글(긱뉴스 Show GN, 링크드인, 커리어리)
- 완료 기준: 하루 배치가 사람 손 없이 돌고, 리포트가 온다

PG 심사가 Day 13까지 안 끝나면 결제 없이 무료로 먼저 공개하고, 플러스 체험만 열어 둔다.

---

## 12. 테스트와 운영

**테스트**
- 단위(node:test + tsx, `pnpm test`): canonicalUrl, clusterAssign, rankFeed(다양성·피드백·콜드스타트), 처음 토픽 가중치, 챕터 계산, 플레이어 상태 머신, RSS XML 스냅샷, entitlements, 크론의 KST 슬롯 계산.
- 프롬프트 점검: `pipeline/fixtures/`에 고정 샘플 30건을 둔다. 요약·why·대본을 사실 오류, 길이, 말투, 원문 근거 기준으로 사람이 본다. 모델이나 프롬프트를 바꿀 때마다 다시 돌린다.
- E2E(Playwright, 선택): Supabase 테스트 유저 → 온보딩 → `/today` 카드 5개 → 이어 듣기(오디오 fixture).
- 실기기: iOS·Android 앱(FCM 푸시, 잠금 화면 이어 듣기, 딥링크), 아이폰 홈 화면 PWA·안드로이드 Chrome(웹 FCM), 카플레이·안드로이드 오토(팟캐스트 앱).

**모니터링**
- report 단계가 매일 보낸다: 수집 건수, 새 클러스터, 요약 실패·refusal 수, 피드 생성 유저 수, 오디오 생성 분, 추정 비용, 실패 소스.
- Actions 실패는 바로 알린다. 06:30 첫 슬롯 전에 오늘 feeds가 없으면 경고한다.

**비용 가드**
- `usage_log`의 하루 합계가 `DAILY_USD_CAP`을 넘으면, 새 오디오 생성을 멈추고 요약 대상을 상위 100개로 줄인다.

**보존**

| 데이터 | 기간 |
| --- | --- |
| 기사 본문 | 저장 안 함(실행 중 임시 파일만) |
| items, clusters, cluster_topics | 90일 |
| summaries, cluster_why | 보관함에 쓰므로 유지 |
| audio_segments(R2) | 30일 |
| episodes(R2) | 7일 |
| packs(R2) | 1년 |

Supabase 일일 백업이 켜져 있는지 확인한다(Pro).

---

## 13. 미결 사항

| # | 정할 것 | 선택지 | 정하는 날 |
| --- | --- | --- | --- |
| 1 | 요약·why·대본 모델 | **결정(2026-10-09)**: 무료 Gemini Flash, 플러스·체험 상위 모델. 남은 것은 고정 버전 이름과 등급별 하루 비용 | Day 5, 30건 실측 |
| 2 | 검색 API | Exa · Tavily | Day 3 |
| 3 | Gemini TTS 모델 ID·단가·한국어 품질 | 실측 | Day 8 |
| 4 | 임베딩 차원 | 768 · 1536 | Day 4 |
| 5 | iOS 백그라운드 재생 | 앱(Capacitor)은 UIBackgroundModes로 해결. 웹 PWA는 단일 파일로 되는지 실기기 확인 | Day 10 |
| 6 | PG사 | 토스페이먼츠 · KG이니시스 | Day 1 신청 때 |
| 7 | 카카오 로그인 | 런칭 후 가입 이탈을 보고 결정 | 런칭 후 |
| 8 | 상표·도메인 | KIPRIS 9류·42류 확인 | Day 1 |
| 9 | 앱 안 결제 | 애플 인앱 결제·플레이 결제(수수료 15~30%) · 한국 대체 결제(스토어 수수료가 약 4%p 낮아지고 PG 수수료는 따로) · 앱에서는 결제를 빼고 웹에서만 가입(스토어 정책상 안내 문구 제한) | 앱 제출 전 |
| 10 | 번들 ID·패키지명 | 기본안 `kr.maengo.app`. 애플 App ID·Firebase·플레이 콘솔에 같은 값. 등록하면 못 바꾼다 | Firebase·애플 등록 전 |
