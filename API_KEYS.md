# 맹고 외부 서비스·키 준비

값은 모두 `apps/web/.env.local`에 넣는다(git에 안 올라감). 형식은 [apps/web/.env.example](apps/web/.env.example).

## 끝난 것

### Supabase — 2026-10-09 만듦
- 프로젝트 `maengo` · ref `dplqcugmgrugfrzjylqw` · 서울(ap-northeast-2) · 무료 요금제 · 조직 `madorik's Org`
- 스키마·RLS·토픽 사전 적용(`supabase/migrations/`). 보안 점검 경고 0건
- 로그인 설정: 사이트 주소 `http://localhost:3000`, 돌아올 주소 `localhost:3000/**`·`localhost:3100/**`, 이메일 가입 끔
- `.env.local`에 넣어 둔 값: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`
- 무료 프로젝트는 1주일 동안 요청이 없으면 일시 정지된다. 대시보드에서 다시 켜면 된다

### Gemini API — 2026-10-09 키 받음
- AI Studio 키(`AQ.`로 시작), Gemini API(`generativelanguage.googleapis.com`)에서 동작한다. 무료 등급(결제 꺼짐)
- `gemini-flash-latest`는 이날 `gemini-3.8-flash`를 가리켰다. 혼잡(503)이 잦아 재시도하고, 계속되면 `gemini-flash-lite-latest`로 대신한다
- **Pro 모델은 무료 등급 할당량이 0**이다. 결제를 켜기 전까지 플러스·체험도 기본(Flash) 요약을 본다. 파이프라인이 알아서 건너뛴다
- 무료 등급은 분당·하루 호출 한도가 있고, 입력이 Google 제품 개선에 쓰일 수 있다(공개 기사라 지금은 괜찮음)
- 실행마다 `usage_log`에 추정 비용을 남긴다. 2026-10-09 기준 글 391개 임베딩 $0.007, 요약 3개 $0.007(유료 단가 기준, 실제 청구 0)

### 데모 계정 — 2026-10-09 만듦
- Supabase 유저 `demo@example.com`(관리자 API로 만듦, 메일 안 나감). 관심 토픽은 비용을 아끼려고 LLM 에이전트 하나
- 애플·구글 연동 전까지 로그인 버튼 두 개 모두 이 계정으로 들어간다(서명한 세션 쿠키, `SESSION_SECRET`)

로그인 콜백 주소(아래 구글·애플 설정에 그대로 넣는다):

```
https://dplqcugmgrugfrzjylqw.supabase.co/auth/v1/callback
```

## 직접 해 주셔야 하는 것

계정 로그인·결제·본인 확인이 필요해서 대신 만들 수 없다. 값을 `.env.local`에 넣고 알려 주면 나머지(Supabase 설정, 코드 연결)는 이쪽에서 한다.

### 1. Gemini 결제 켜기 — 출시 전에
키는 받았다(위). 플러스 유저에게 상위 모델 요약을 주려면 [AI Studio](https://aistudio.google.com/apikey)에서 결제를 연결한다. 그 전까지는 모두 Flash 요약이다.

### R2 키 — 5분
버킷 `maengo-storage`(계정 `ace834d6e28e47b5fbb47974fd7d6c6a`)는 만들어 두셨다. 2026-10-09 키를 받아 `.env.local`에 넣었는데 **읽기 전용 토큰**이라 업로드가 403이다. 권한을 Object Read & Write로 바꿔야 한다(그 전까지 개발 서버는 `AUDIO_STORE=local`).
1. Cloudflare 대시보드 → R2 Object Storage → API Tokens(Manage) → Create API Token
2. 권한 **Object Read & Write**, 버킷은 **maengo-storage만**
3. 나오는 Access Key ID·Secret Access Key(한 번만 보임)를 `.env.local`의 `R2_ACCESS_KEY_ID`·`R2_SECRET_ACCESS_KEY`에

버킷은 비공개로 둔다. 웹이 서명 URL을 만들어 `<audio>`가 R2에서 바로 받는다(CORS 설정 필요 없음).

### GitHub Actions 시크릿 — 일일 배치를 켤 때
`.github/workflows/daily.yml`이 매일 04:00 KST에 돈다. 저장소 Settings → Secrets and variables → Actions에 넣는다.

| 이름 | 종류 | 값 |
| --- | --- | --- |
| `SUPABASE_URL` | 시크릿 | `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`과 같다 |
| `SUPABASE_SERVICE_ROLE_KEY` | 시크릿 | `.env.local`과 같다 |
| `GEMINI_API_KEY` | 시크릿 | `.env.local`과 같다 |
| `PIPELINE_SUMMARIZE_LIMIT` | 변수(선택) | 비우면 5. 출시 때 40 안팎으로 |
| `PIPELINE_VIDEO_LIMIT` | 변수(선택) | 비우면 0. 영상 요약을 켤 때 2 안팎으로 |

### 2. 구글 로그인 — 15분
1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 만들기(이름 `maengo`)
2. API 및 서비스 → OAuth 동의 화면: 외부, 앱 이름 `맹고`, 범위는 기본(email·profile·openid)만
3. 사용자 인증 정보 → OAuth 클라이언트 ID → 웹 애플리케이션
   - 승인된 JavaScript 원본: `http://localhost:3000`, 운영 주소(예: `https://maengo.kr`)
   - 승인된 리디렉션 URI: 위 Supabase 콜백 주소
4. `.env.local`: `GOOGLE_CLIENT_ID=…`, `GOOGLE_CLIENT_SECRET=…`
5. 앱(iOS·Android)에서 구글 로그인을 띄울 때는 iOS·Android 클라이언트 ID를 더 만든다 → `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`(앱 단계에서)

### 3. 애플 로그인 + iOS 푸시 키 — 개발자 멤버십 승인 후 20분
1. [Apple Developer Program](https://developer.apple.com/programs/) 가입(연 $99). 개인은 수일 걸린다
2. Identifiers → App IDs → `kr.maengo.app`(번들 ID, 아래 "정해야 할 것" 참고), Sign in with Apple·Push Notifications 켜기
3. Identifiers → Services IDs → `kr.maengo.web`, Sign in with Apple 켜고 Configure
   - Domains: `dplqcugmgrugfrzjylqw.supabase.co`, 운영 도메인
   - Return URLs: 위 Supabase 콜백 주소
4. Keys → 새 키, **Sign in with Apple**과 **Apple Push Notifications service(APNs)** 둘 다 체크 → `.p8` 내려받기(한 번만 받을 수 있다). 키 ID 메모
5. `.env.local`: `APPLE_TEAM_ID`(계정 오른쪽 위 10자리), `APPLE_KEY_ID`, `APPLE_SERVICES_ID=kr.maengo.web`, `APPLE_BUNDLE_ID=kr.maengo.app`, `APPLE_PRIVATE_KEY_PATH=/절대/경로/AuthKey_XXXX.p8`
6. 나가는 메일: "나의 이메일 가리기" 사용자에게 메일을 보내려면 Services → Sign in with Apple for Email Communication에 발신 도메인 등록(SPF·DKIM)

### 4. Firebase(FCM 푸시) — 15분
1. [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트 추가(구글 로그인과 같은 Google Cloud 프로젝트 `maengo`를 고르면 한곳에서 관리된다). 애널리틱스는 꺼도 된다
2. 앱 추가
   - Android: 패키지명 `kr.maengo.app` → `google-services.json` 내려받기(앱 단계에서 쓴다)
   - iOS: 번들 ID `kr.maengo.app` → `GoogleService-Info.plist` 내려받기
   - 웹: 앱 이름 `맹고 웹` → 나오는 설정값을 `.env.local`의 `NEXT_PUBLIC_FIREBASE_*`에
3. 프로젝트 설정 → 클라우드 메시징
   - Apple 앱 구성 → APNs 인증 키 업로드(3번의 `.p8`, 키 ID, 팀 ID)
   - 웹 구성 → 웹 푸시 인증서 → 키 쌍 생성 → `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
4. 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성(JSON) → 저장소 밖에 두고 `FIREBASE_SERVICE_ACCOUNT_PATH=/절대/경로/….json`

### 넣은 뒤 할 일
```bash
pnpm setup:auth     # 구글·애플 로그인을 Supabase에 켠다(애플 시크릿 6개월짜리도 새로 만든다)
```
애플 시크릿은 6개월마다 만료된다. 만료 전에 `pnpm setup:auth`를 다시 돌린다(달력에 알림 걸기).

## 정해야 할 것
- **번들 ID·패키지명**: 기본안 `kr.maengo.app`(웹 로그인용 Services ID는 `kr.maengo.web`). 애플·Firebase·플레이 콘솔에 등록하면 바꿀 수 없다
- **앱 안 결제**: 앱에서 플러스를 팔면 애플·구글 결제를 써야 한다(PLAN.md 9.3, 13장 9번)

## 나중 단계

| 변수 | 받는 곳 | 단계 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 직접 정한다(예: `https://maengo.kr`) | 배포. 공유 카드·사이트맵·canonical. 바꾸면 다시 빌드 |
| `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION` | Google Search Console, 네이버 서치어드바이저(HTML 태그 방식) | 배포 후 검색 등록 |
| `SEARCH_API_KEY` | Exa 또는 Tavily | 수집 파이프라인 |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend(발신 도메인 DNS 인증) | 이메일 알림 |
| `PORTONE_*` | 포트원 콘솔(PG 심사 1~2주) | 웹 정기결제 |
| `CRON_SECRET` | 직접 만든다: `openssl rand -hex 32` | 알림·결제 크론 |
| `GITHUB_DISPATCH_TOKEN` | GitHub fine-grained 토큰(Actions 쓰기만) | 에피소드 재조립 |
| `ALERT_WEBHOOK_URL`, `DAILY_USD_CAP` | 텔레그램 봇 또는 슬랙 웹훅 / 하루 비용 상한 | 일일 리포트·비용 가드 |
| 플레이 콘솔 | Google Play Console(1회 $25) | Android 출시 |

## AI 모델 이름(키 아님)

| 변수 | 기본값 | 누가 쓰나 |
| --- | --- | --- |
| `GEMINI_MODEL_FREE` | `gemini-flash-latest` | 무료 플랜의 요약·문구 |
| `GEMINI_MODEL_PLUS` | `gemini-pro-latest` | 플러스·체험의 요약·문구, 오디오 대본 |
| `GEMINI_TTS_MODEL` | `gemini-3.8-flash-tts` | 음성 합성(플러스 전용). 2026-10-09 무료 등급으로 동작 확인, 더 싼 `gemini-3.8-flash-lite-tts`도 됨 |

`-latest` 별칭은 Google이 새 버전으로 자동으로 바꾼다. 결과가 갑자기 달라지는 게 싫으면 키를 넣는 날 고정 버전으로 바꾼다.
