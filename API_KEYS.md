# 맹고 API 키 목록

`apps/web/.env.local`에 넣으면 된다. 형식은 [apps/web/.env.example](apps/web/.env.example)에 있다.
지금 코드는 키 없이 더미로 돈다. **키를 넣어도 바로 실제 호출로 바뀌지는 않는다.** 키가 들어오면 해당 클라이언트 코드를 붙인다.

## 1. 지금 필요한 키 — AI(더미를 실제로 바꿀 때)

| 변수 | 받는 곳 | 메모 |
| --- | --- | --- |
| `GEMINI_API_KEY` | [Google AI Studio → API keys](https://aistudio.google.com/apikey) | 요약·"왜 중요한가"·대본·토픽 매핑·유튜브 요약·임베딩·TTS를 이 키 하나로 쓴다. **결제(유료 티어)를 켜야 한다.** 무료 티어는 유튜브 길이 제한(하루 8시간)과 요청 한도가 낮고, 입력 내용이 Google 제품 개선에 쓰일 수 있다. |

모델은 키가 아니라 이름만 바꾸면 된다. 비워 두면 아래 기본값을 쓴다.

| 변수 | 기본값 | 누가 쓰나 |
| --- | --- | --- |
| `GEMINI_MODEL_FREE` | `gemini-flash-latest` | 무료 플랜의 요약·문구 |
| `GEMINI_MODEL_PLUS` | `gemini-pro-latest` | 플러스·체험의 요약·문구, 오디오 대본 |
| `GEMINI_TTS_MODEL` | `gemini-2.5-flash-preview-tts` | 음성 합성(플러스 전용) |

`-latest` 별칭은 Google이 새 버전으로 자동으로 바꾼다. 결과가 갑자기 달라지는 게 싫으면 키를 넣는 날 고정 버전 이름으로 바꾼다. TTS 모델 이름은 그날 AI Studio에서 한국어 품질을 듣고 정한다.

## 2. 로그인 붙일 때 — Supabase · Google · Apple

| 변수 | 받는 곳 | 메모 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 → Project Settings → API | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 같은 곳(publishable 키) | 브라우저에 나가도 되는 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 곳(secret 키) | 서버 전용. 절대 `NEXT_PUBLIC_`을 붙이지 않는다 |

Google·Apple 로그인 키는 앱 환경 변수가 아니라 **Supabase 대시보드 → Authentication → Providers**에 넣는다.

- **Google**: Google Cloud Console에서 OAuth 클라이언트(웹)를 만들고 클라이언트 ID·시크릿을 Supabase에 넣는다. 리디렉션 URI는 `https://<프로젝트>.supabase.co/auth/v1/callback`.
- **Apple**(개발자 멤버십 연 $99): Team ID, Services ID, Key ID, `.p8` 키 파일이 필요하다. 이걸로 만든 client secret(JWT)을 Supabase에 넣는데, **최대 6개월마다 다시 만들어야 한다.** 만드는 스크립트는 로그인 단계에서 같이 만든다.

## 3. 배포할 때 — SEO

| 변수 | 받는 곳 | 메모 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 직접 정한다(예: `https://maengo.kr`) | 공유 카드, 사이트맵, canonical 주소에 쓴다. 비우면 Vercel 운영 주소를 쓴다 |
| `GOOGLE_SITE_VERIFICATION` | [Google Search Console](https://search.google.com/search-console) → 속성 추가 → HTML 태그 방식의 content 값 | 넣으면 `google-site-verification` 메타가 붙는다 |
| `NAVER_SITE_VERIFICATION` | [네이버 서치어드바이저](https://searchadvisor.naver.com) → 사이트 등록 → HTML 태그 방식의 content 값 | 한국 검색은 네이버 등록이 중요하다. 등록 뒤 사이트맵(`/sitemap.xml`)도 제출한다 |

## 4. 나중 단계

| 변수 | 받는 곳 | 단계 |
| --- | --- | --- |
| `SEARCH_API_KEY` | Exa 또는 Tavily | 수집 파이프라인 |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL` | Cloudflare → R2 → API 토큰 | 오디오 파일 저장 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 가입 없이 직접 만든다: `npx web-push generate-vapid-keys` | 웹 푸시 알림 |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend(발신 도메인 DNS 인증 필요) | 이메일 알림 |
| `PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`, `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET` | 포트원 콘솔(PG 심사 1~2주) | 정기결제 |
| `CRON_SECRET` | 직접 만든다: `openssl rand -hex 32` | 알림·결제 크론 |
| `GITHUB_DISPATCH_TOKEN` | GitHub fine-grained 토큰(Actions 쓰기만) | 말투 바꿀 때 에피소드 재조립 |
| `ALERT_WEBHOOK_URL`, `DAILY_USD_CAP` | 텔레그램 봇 또는 슬랙 웹훅 / 하루 비용 상한(달러) | 일일 리포트·비용 가드 |
