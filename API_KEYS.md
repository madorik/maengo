# 맹고 외부 서비스·키 준비

값은 모두 `apps/web/.env.local`에 넣는다(git에 안 올라감). 형식은 [apps/web/.env.example](apps/web/.env.example).

## 끝난 것

### Supabase — 2026-10-09 만듦
- 프로젝트 `maengo` · ref `dplqcugmgrugfrzjylqw` · 서울(ap-northeast-2) · 무료 요금제 · 조직 `madorik's Org`
- 스키마·RLS·토픽 사전 적용(`supabase/migrations/`). 보안 점검 경고 0건
- 로그인 설정: 사이트 주소 `http://localhost:3000`, 돌아올 주소 `localhost:3000/**`·`localhost:3100/**`, 이메일 가입 끔
- `.env.local`에 넣어 둔 값: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`
- 무료 프로젝트는 1주일 동안 요청이 없으면 일시 정지된다. 대시보드에서 다시 켜면 된다

로그인 콜백 주소(아래 구글·애플 설정에 그대로 넣는다):

```
https://dplqcugmgrugfrzjylqw.supabase.co/auth/v1/callback
```

## 직접 해 주셔야 하는 것

계정 로그인·결제·본인 확인이 필요해서 대신 만들 수 없다. 값을 `.env.local`에 넣고 알려 주면 나머지(Supabase 설정, 코드 연결)는 이쪽에서 한다.

### 1. Gemini API 키 — 5분
1. [Google AI Studio → API keys](https://aistudio.google.com/apikey)에서 키 만들기
2. 같은 화면에서 결제(유료 티어) 연결. 무료 티어는 유튜브 길이 제한이 낮고 입력이 제품 개선에 쓰일 수 있다
3. `.env.local`: `GEMINI_API_KEY=…`

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
| `R2_*` | Cloudflare → R2 → API 토큰 | 오디오 파일 저장 |
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
| `GEMINI_TTS_MODEL` | `gemini-2.5-flash-preview-tts` | 음성 합성(플러스 전용) |

`-latest` 별칭은 Google이 새 버전으로 자동으로 바꾼다. 결과가 갑자기 달라지는 게 싫으면 키를 넣는 날 고정 버전으로 바꾼다.
