# 맹고 앱(iOS·Android) 개발 계획

> 2026-10-10 작성. 웹(maengo.vercel.app)은 운영 중이고, 이 문서는 하이브리드 앱(Capacitor)을 만드는 다음 작업의 출발점이다.
> 큰 설계는 PLAN.md 9.2(알림)·9.3(앱)에 있고, 이 문서는 실제로 할 일·순서·완료 기준을 적는다. 둘이 다르면 이 문서를 따른다.

## 0. 먼저 읽을 것(작업 규칙)

- **Next.js 16**: 학습 데이터와 다르다. 코드를 쓰기 전에 `apps/web/node_modules/next/dist/docs/`의 해당 안내를 읽는다(apps/web/AGENTS.md).
- **커밋**: 작성자 이메일은 `xornjs1988@gmail.com`(저장소 local git config에 이미 있음). 다른 이메일이면 Vercel이 배포를 막는다.
- **푸시**: 전역 gh 계정은 바꾸지 않고 한 번만 토큰을 붙인다.
  `git -c http.https://github.com/.extraheader="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$(gh auth token --user madorik)" | base64)" push origin main`
- **웹 배포**: 저장소 루트에서 `npx vercel deploy --prod --yes`. CLI는 git이 아니라 작업 폴더를 올리므로, 커밋 안 한 파일이 있으면 `git stash push -u -- <경로>`로 치우고 배포한 뒤 되돌린다.
- **DB**: 마이그레이션은 `supabase/migrations/`에 쓰고 `supabase db push --yes`. 운영 DB에 바로 들어가므로, 운영 웹 코드와 어긋나는 변경(이름 바꾸기·지우기)은 코드 배포와 같이 한다. 더하기만 하는 변경은 먼저 넣어도 된다.
- **비밀값**: 키·토큰·.p8·서비스 계정 JSON은 출력하지도 커밋하지도 않는다. `.env.local`과 `~/.maengo/`는 저장소 밖이거나 gitignore 대상이다. 커밋 전에 비밀값 패턴을 훑는다.
- **비용**: 개발 중에는 LLM·TTS 호출을 최소로(토픽 1개, 몇 건). 범위를 넓히기 전에 호출 수를 사용자에게 알리고 묻는다. Gemini는 무료 등급이다(TTS 하루 10번, 임베딩 분당 약 100개).
- **실제 계정은 건드리지 않는다**: `xornjs1988@gmail.com`(사용자), `wandeung.help@gmail.com`(지인). 시험은 임시 계정을 만들어 하고 끝나면 지운다. 임시 계정의 관심사는 실제 계정과 겹치지 않게 고른다(요약은 계정끼리 공유돼서, 같은 관심사로 시험하면 실제 계정 화면에 저절로 보인다).
- **zsh**: 셸 반복문 변수 이름으로 `path`를 쓰지 않는다(PATH가 덮인다).

## 1. 목표와 범위

**목표**: 스토어에 올릴 수 있는 iOS·Android 앱. 화면은 운영 웹을 그대로 띄우고, 앱에서만 되는 네 가지를 붙인다.

1. 네이티브 로그인(애플·구글 창) — 구글은 웹뷰 안 로그인을 막는다(`disallowed_useragent`), 그래서 필수
2. 푸시 알림(설정한 시각에 "오늘의 맹고가 도착했어요")
3. 화면을 꺼도 이어지는 듣기(잠금 화면 조작)
4. 앱다운 마감: 아이콘·스플래시·상태 표시줄, 안드로이드 뒤로 가기, 원문 링크는 인앱 브라우저, 공유 시트, 오프라인 안내

**이번 범위 밖**
- 인앱 결제: 사업자등록 뒤에 한다(RevenueCat으로 애플·구글 결제를 묶어 `profiles.plan`·`premium_until`을 바꾼다). 그 전에는 앱 안에서 결제나 외부 결제 안내를 보여 주지 않는다.
- 오프라인 에피소드 저장, 위젯: 애플 4.2(최소 기능)로 거절되면 그때 붙인다.

## 2. 지금 상태(확정된 것)

| 항목 | 값·상태 |
| --- | --- |
| 번들 ID·패키지명 | `kr.maengo.app`(iOS·Android 같음, 등록하면 못 바꿈). 웹 애플 로그인용 Services ID는 `kr.maengo.web` |
| 애플 | 팀 `QYS79FM739`, 키 `XKH9RW6Y9W`(`~/.maengo/AuthKey_XKH9RW6Y9W.p8`). 이 키에 APNs가 켜져 있는지 확인 필요 |
| 웹 로그인 | 서버에서만 처리한다. `app/actions.ts`의 `signIn`이 `signInWithOAuth` → `/auth/callback`에서 코드 교환 → `@supabase/ssr`가 쿠키에 세션. 브라우저용 Supabase 클라이언트는 없다 |
| 로그인 확인 | `apps/web/proxy.ts`가 쿠키의 토큰 서명만 본다. 사용자가 없으면 화면이 `/auth/signout`으로 보내 쿠키를 지운다 |
| 알림 데이터 | `device_tokens(token, user_id, platform android·ios·web, app_version, last_seen_at)`, `notifications_log(user_id, date, channel)` 표가 이미 있다. `profiles.notify_at`은 06:00~23:30, 30분 단위(설정 화면에서 고름) |
| 듣기 | `<audio>` 하나 + Media Session(잠금 화면 제목·조작)을 이미 쓴다(`components/providers/PlayerProvider.tsx`). Free는 듣기 잠금, Premium은 제한 없음 |
| 오늘 피드 | 가입 후 첫 방문은 "오늘 맹고 받기"를 눌러야 받는다. 그 뒤로는 서버 스케줄러가 알림 시각 30분 전에 만들고 알림 시각에 보낸다 |
| 스토어 필수 문서·기능 | 있음(2026-10-10): `/terms`, `/privacy`, `/delete-account`(공개 페이지, 구글 플레이 '계정 삭제 URL'에 쓴다), 설정 > 계정 > 계정 삭제. 운영자·문의 메일·시행일은 `apps/web/lib/site.ts` |
| 개발 도구 | Xcode 26.3(iOS는 SPM, CocoaPods 안 씀). Android Studio 2025.3 있음(SDK는 안 잡혀 있음). SDK·에뮬레이터는 Homebrew `android-commandlinetools`(`/opt/homebrew/share/android-commandlinetools`)를 CLI 빌드에 쓴다. JDK는 Android Studio 내장 JBR 21. 맹고용 에뮬레이터 `maengo_api36`(Pixel 8, Android 16, Play) |
| 앱 버전 | Capacitor 8.5.3, @capacitor/app 8.1.2, browser 8.0.5, splash-screen 8.0.2(2026-10-10 최신 안정판). 웹과 앱에 같은 버전으로 넣는다 |

## 3. 구조

```
apps/mobile/                  @maengo/mobile (pnpm 워크스페이스 apps/*에 포함)
├─ capacitor.config.ts        appId kr.maengo.app, appName 맹고, server.url = 운영 웹(CAP_SERVER_URL로 바꿈)
├─ offline.html               웹을 못 불러올 때 안내 화면 원본. sync 때 서버 주소를 넣어 www/index.html로 만든다(www는 gitignore)
├─ ios/                       Xcode 프로젝트(커밋한다)
├─ android/                   Android Studio 프로젝트(커밋한다)
├─ assets/                    아이콘·스플래시 원본 PNG(scripts/render-assets.mjs가 icon.svg 그림으로 만든다)
└─ scripts/render-assets.mjs
```

**개발 실행**(apps/mobile에서. 안드로이드는 `export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`)
- 개발 서버로: `CAP_SERVER_URL=http://localhost:3100 npx cap sync` → `npx cap run ios` / `adb reverse tcp:3100 tcp:3100 && npx cap run android`. 시뮬레이터·에뮬레이터는 localhost로 맥에 닿는다
- 실기기는 `http://<맥 LAN IP>:3100`. 단 맥 방화벽이 node의 들어오는 연결을 막고 있어(2026-10-10 확인) 풀어야 하고, Next 개발 서버의 `allowedDevOrigins`에 그 IP를 더해야 한다
- 운영으로 되돌리기: `CAP_SERVER_URL` 없이 `npx cap sync`. 서버 주소는 sync 때 네이티브 프로젝트에 들어가므로 바꿀 때마다 sync한다
- 아이콘·스플래시를 바꾸면: `node scripts/render-assets.mjs && npx @capacitor/assets@3.0.5 generate --ios --android`(pnpm dlx는 sharp 설치 스크립트를 막아 실패한다)

- **원격 URL 방식**: `server.url`(기본 `https://maengo.vercel.app`, 개발 때는 `CAP_SERVER_URL=http://<맥 LAN IP>:3100`)을 띄운다. 웹이 서버 컴포넌트·Server Actions를 써서 정적 export로 넣을 수 없다. 웹을 배포하면 앱도 바로 바뀐다(스토어 심사 없음). Capacitor 문서는 `server.url`을 라이브 리로드용으로 설명하니, 4.2 거절을 줄이려면 1장의 앱 전용 기능을 꼭 갖춘다.
- **앱인지 알아내기**: `appendUserAgent: 'MaengoApp/<버전> (ios|android)'`. 서버는 UA로(`lib/server/app-client.ts` 같은 헬퍼), 브라우저 코드는 `Capacitor.isNativePlatform()`으로 본다.
- **플러그인 JS는 웹에 넣는다**: 원격 페이지에도 Capacitor 브리지가 주입되므로, 플러그인 호출은 `apps/web`에서 `@capacitor/core`와 각 플러그인을 import해 `isNativePlatform()`일 때만 부른다. 네이티브 쪽은 `apps/mobile`에 같은 플러그인을 설치하고 `npx cap sync`.
- **쓸 플러그인**(설치할 때 최신 안정판·Capacitor 메이저 버전 호환을 확인)
  - 공식: `@capacitor/app`(딥링크·뒤로 가기), `@capacitor/browser`(원문 링크), `@capacitor/splash-screen`, `@capacitor/haptics`, `@capacitor/share`. 상태 표시줄은 Capacitor 8 코어의 SystemBars로 한다(`@capacitor/status-bar`는 안드로이드 15+에서 색·겹침 설정이 안 먹는다). 오프라인은 `server.errorPath` 안내 화면으로 해서 `@capacitor/network`는 아직 안 쓴다
  - Firebase: `@capacitor-firebase/messaging`(푸시), `@capacitor-firebase/authentication`(애플·구글 네이티브 로그인, `skipNativeAuth: true`로 ID 토큰만 받는다. Firebase 로그인은 하지 않는다)

## 4. 단계

각 단계는 실기기에서 완료 기준을 확인하고 커밋한다. 웹 쪽 변경은 앱 밖(일반 브라우저)에서 아무것도 바뀌지 않게 `isNativePlatform()`/UA로 가둔다.

### 1단계. 껍데기(1~2일)

- [x] `apps/mobile` 만들기, `npx cap add ios`·`npx cap add android`(워크스페이스는 기존 `apps/*`에 포함)
- [x] 아이콘·스플래시: `apps/web/app/icon.svg`(망고) 그림으로 `@capacitor/assets` 생성. 스플래시 바탕은 망고색 `#FFC23D`. 안드로이드 적응형 아이콘은 원·둥근 사각형 마스크에서 잎까지 들어가게 줄였다
- [x] 상태 표시줄·안전 영역: SystemBars `insetsHandling: native` + 웹의 `viewport-fit=cover`·`env(safe-area-inset-*)` 그대로. 앱은 밝은 화면으로 고정(iOS `UIUserInterfaceStyle Light`, 안드로이드 Light 테마·흰 창 바탕), 폰은 세로 고정
- [x] 안드로이드 뒤로 가기: 열린 시트 닫기 → 웹 기록 뒤로 → 첫 화면(`/today`·`/login`·`/onboarding`)이면 앱을 내린다(`minimizeApp`, 안드로이드 12+ 기본 동작과 같고 듣던 음성을 끊지 않는다). 로그인 뒤 기록에 `/login`이 남아 첫 화면에서는 기록을 보지 않는다
- [x] 원문 링크는 앱에서 `Browser.open`(인앱 브라우저). 컴포넌트마다 고치지 않고 바깥 주소 링크 클릭을 한곳(`lib/native/shell.ts`)에서 받는다
- [x] 앱에서 `/`로 오면 로그인 여부에 따라 `/today`·`/login`. proxy matcher에 User-Agent 조건을 걸어 브라우저 요청은 proxy를 타지 않는다(`/`는 계속 정적)
- [x] 웹을 못 불러오면 안내 화면 + 다시 시도. 연결이 돌아오면 저절로 다시 불러온다(서버에 닿는지 3초마다 확인). 안드로이드는 안내 화면에서 뒤로 가기로 앱을 내린다(`MainActivity`)
- 완료(2026-10-10, 시뮬레이터·에뮬레이터): iOS 26 시뮬레이터(iPhone 17 Pro)·안드로이드 16 에뮬레이터에서 운영 웹이 뜨고, 개발 서버로 데모 로그인 → 오늘 → 소식 → 원문(인앱 브라우저) → 뒤로, 시트 닫기, 로고(`/`) → 오늘, 오프라인 안내·자동 복구, 앱 재시작 후 로그인 유지를 확인했다. **실기기 확인은 남았다**
- 남은 것·메모
  - 실기기 확인(위 "개발 실행"의 방화벽·`allowedDevOrigins` 먼저)
  - 에뮬레이터 웹뷰가 133이라 옛 웹뷰 경로(상태 표시줄 자리를 여백으로 비움)만 봤다. 웹뷰 140+(edge-to-edge, `env()`가 값을 가짐)는 실기기에서 본다
  - 운영 웹에는 아직 배포 안 함. 배포 전 앱은 소개 페이지가 뜨고 스플래시가 3초 뒤 저절로 걷힌다
  - iOS는 웹뷰 스와이프 뒤로 가기가 꺼져 있다(Capacitor 기본). 화면의 "‹" 버튼으로 돌아간다. 켜려면 `allowsBackForwardNavigationGestures`(네이티브)
  - iOS 26 시뮬레이터(영어 설정)에서 `system-ui`·`-apple-system` 글꼴이 한글을 네모로 그렸다. 안내 화면은 이 글꼴을 빼서 해결. 웹은 Pretendard가 먼저라 영향 없음

### 2단계. 네이티브 로그인(2~3일)

> 2026-10-11: 비공개 테스트를 먼저 하려고 아래 '대안'(시스템 브라우저 + 딥링크)으로 구현했다(사용자 결정). `/api/auth/app` → iOS ASWebAuthenticationSession(`ios/App/App/NativeAuth.swift`)·안드로이드 Custom Tabs → `kr.maengo.app://auth/callback?code=` → 웹뷰가 `/auth/callback?code=`. Supabase 허용 목록에 `kr.maengo.app://**`. 실기기 로그인 확인은 테스트 빌드로 한다. 네이티브 SDK 로그인은 나중에 바꿔도 된다.

흐름: 앱 로그인 버튼 → `FirebaseAuthentication.signInWithApple()`/`signInWithGoogle()`(`skipNativeAuth`) → ID 토큰(애플은 nonce도) → `POST /api/auth/native {provider, idToken, nonce}` → 서버가 `supabaseAuth()`로 `signInWithIdToken` → 응답 쿠키에 세션 → `/today`(첫 로그인이면 `/onboarding`).

- [ ] `/api/auth/native` 라우트(서버에서 세션을 만들어 쿠키를 쓰므로 웹 로그인과 같은 쿠키·proxy를 그대로 쓴다). 데모 세션 쿠키가 있으면 지운다(`/auth/callback`과 같게)
- [ ] 로그인 화면: 앱이면 서버 액션 대신 네이티브 버튼을 쓴다(iOS는 애플을 위에 둬도 되지만 지금 순서인 구글 → 애플을 유지해도 된다)
- [ ] Supabase 대시보드: 구글 제공자의 Client IDs에 iOS·Android OAuth 클라이언트 ID를 더한다. 애플 제공자의 Client IDs에 `kr.maengo.app`을 더한다(`kr.maengo.web`과 함께). `scripts/supabase-auth.mjs`로 관리하면 거기에 더한다
- [ ] 알려진 함정(확인하며 진행)
  - 구글 iOS는 SDK가 nonce를 넣어 Supabase nonce 검사와 어긋날 수 있다 → 구글 제공자의 "Skip nonce check"가 필요한지 확인
  - 애플은 이름을 첫 로그인 때만 준다 → 받은 이름을 `profiles.display_name`에 넣는다
  - 안드로이드 구글 로그인은 서명 키의 SHA-1이 Firebase·Google Cloud에 등록돼야 한다(디버그 키, 나중에 Play 앱 서명 키도)
- [ ] 로그아웃: 기존 `signOut` 액션 + 네이티브 쪽 `FirebaseAuthentication.signOut()`
- 대안(네이티브 로그인이 막히면): 시스템 브라우저로 OAuth를 열고 `kr.maengo.app://auth/callback` 딥링크로 돌아와 웹뷰를 `/auth/callback?code=…`로 보낸다(PKCE 검증 쿠키는 웹뷰에 있다). Supabase Redirect URLs에 스킴을 더해야 한다
- 완료: 두 기기에서 애플·구글로 로그인, 앱을 껐다 켜도 로그인 유지(WKWebView 쿠키 유지 확인), 로그아웃 후 다시 로그인

### 3단계. 푸시 — 서버는 끝(2026-10-11), 앱만 남음

**서버(끝남)**
- 스케줄 표 `delivery_jobs`(사람·날짜마다 한 줄: build_at = 알림 30분 전, notify_at = 알림 시각, 상태 pending → building → ready → sending → sent / empty / no_device / failed, 시도 횟수·마지막 오류)
- 작업 표 `scheduler_tasks`(작업마다 한 줄: 주기·켜짐·예산 config·다음 차례·마지막 결과). Supabase `pg_cron`이 5분마다 `POST /api/cron/scheduler`(비밀값은 Vault의 `cron_secret`, 서버 `CRON_SECRET`) → `pipeline/src/scheduler.ts`가 차례가 된 작업만 돌린다: `deliveries` 5분, `ingest`(수집·임베딩·묶기·태그) 30분, `summarize`(요약·중복 합치기) 30분, `daily`(Premium 기한) 하루. GitHub Actions `daily.yml`은 손으로 돌릴 때만
- `deliveries` 작업 = `pipeline/src/deliveries.ts`의 `runDeliveries`: 오늘 줄 채우기 → 멈춘 줄 되돌리기 → 만들 차례인 사람들 관심사를 합쳐 피드 만들기 → 보낼 차례에 FCM HTTP v1로 발송(죽은 토큰은 지움, `notifications_log` 기록). 상태 확인: `select * from cron_status()`, `select name, next_run_at, last_status, last_error from scheduler_tasks`(서버 키)
- `POST /api/devices {token, platform: 'android'|'ios'|'web', appVersion}`·`DELETE {token}`: 로그인한 사람의 기기 토큰 등록·삭제(웹뷰는 같은 출처라 쿠키로 인증된다)
- Firebase 준비 끝: 설정 파일·서비스 계정·APNs 키·웹 푸시 키(API_KEYS.md 4번)
- 알림 켜고 끄기(2026-10-11): `profiles.push_enabled`(기본 꺼짐). 꺼 두면 맹고는 만들어 두되 보내지 않는다(`delivery_jobs` 'muted'). 설정 > 알림의 '알림 받기' 스위치(`components/settings/PushToggle.tsx`): 켜면 `lib/web-push.ts`의 `registerThisBrowser()`로 기기를 등록한 뒤 서버 액션 `setPushEnabled(true)`(등록된 기기가 없으면 켜지지 않음), 끄면 그 사람의 기기 토큰을 모두 지운다
- 웹 푸시 끝: 서비스 워커 `public/push-sw.js`, Firebase JS SDK는 켤 때만 불러온다. 개인정보 처리방침에 알림 토큰·Google(FCM) 위탁을 넣음(시행일 2026-10-11)

**앱(남음)**
- [ ] `@capacitor-firebase/messaging` 설치, iOS는 Push Notifications·Background Modes(Remote notifications) 켜고 `GoogleService-Info.plist`를 App 타깃에 추가
- [ ] 권한 요청은 사용자 동작에서만: 설정 > 알림의 '알림 받기' 스위치가 앱 안에서는 `registerThisBrowser()`에서 `{ ok: false, reason: 'app' }`을 돌려준다. 여기를 네이티브 권한 요청 → FCM 토큰 → `POST /api/devices`(platform ios·android)로 채우면 스위치가 그대로 동작한다. 온보딩 마지막에 한 번 권하기
- [ ] 앱을 열 때마다 토큰 다시 등록은 `push_enabled`가 켜져 있고 권한이 있을 때만(꺼 두면 서버가 토큰을 지운 상태를 유지)
- [ ] 알림을 누르면 `data.path`(`/today?from=push`)로 이동. 로그아웃하면 `DELETE /api/devices`
- 완료: 실기기 두 대가 설정한 시각에 알림을 받고, 누르면 오늘 화면이 열린다. 같은 날 두 번 오지 않는다

### 4단계. 화면 꺼도 듣기(1~2일, 확인 먼저)

- [ ] iOS: `Info.plist`에 `UIBackgroundModes: audio`, `AppDelegate`에서 `AVAudioSession` 카테고리를 `.playback`으로. 잠금 화면 제목·재생·멈춤·다음은 웹의 Media Session으로 되는지 확인
- [ ] Android: 화면을 끄고 10분 이상 이어지는지 확인. 웹뷰가 멈추면(절전·백그라운드 제한) 미디어 포그라운드 서비스를 띄우는 네이티브 오디오 플러그인으로 바꾼다. 이 경우 플레이어 API(`usePlayer`)는 그대로 두고 재생 엔진만 갈아 끼운다
- 완료: Premium 임시 계정으로 두 기기에서 잠금 상태 10분 연속 재생, 잠금 화면에서 멈춤·다음이 된다. TTS는 하루 10번 한도라 이미 만들어 둔 음성으로 시험한다

### 5단계. 스토어 준비(3~5일, 테스트 기간은 별도)

- [x] **계정 삭제**(애플 필수): 설정 > 계정 > 계정 삭제 → 확인 → `deleteAccount`(app/actions.ts). 2026-10-10 완료
- [x] **이용약관·개인정보 처리방침·계정 삭제 안내**: `/terms`, `/privacy`, `/delete-account`(2026-10-10). 앱에서 새로 처리하는 정보가 생기면(예: 분석 도구) `/privacy`와 시행일을 고친다. 스토어 등록 정보에 이 주소들을 건다
- [x] 앱 안에서 결제·가격 안내를 보이지 않게(iOS). 설정의 베타 안내에서 앱이면 가격을 뺐다(2026-10-11). Premium 상태 표시(왕관)는 그대로
- [ ] 스토어 등록·비공개 테스트: 순서·문구·답은 `apps/mobile/STORE.md`(2026-10-11 작성). Android 업로드 키 `~/.maengo/maengo-upload.jks`, iOS는 아이폰 전용·암호화 면제 선언
- [ ] 스토어 등록 정보: 스크린샷(6.7·6.5인치 아이폰, 안드로이드 폰), 설명, 키워드, 연령 등급, 애플 개인정보 라벨, 플레이 데이터 보안 양식
- [ ] 심사 메모: 로그인은 애플·구글뿐이라 심사자가 자기 계정으로 가입할 수 있다고 적는다. 첫 화면에서 "오늘 맹고 받기"를 눌러야 소식이 나온다고 적는다
- [ ] 배포 경로: iOS TestFlight 내부 → 외부 테스트 → 심사. Android 내부 테스트 → **비공개 테스트(개인 개발자 계정은 테스터 12명 이상, 14일 연속)** → 프로덕션. 14일 조건 때문에 Android 비공개 테스트는 1~2단계가 끝나는 대로 일찍 시작한다
- 완료: TestFlight·Play 비공개 테스트로 실제 사용자가 설치해 쓴다

### 6단계(나중). 인앱 결제

사업자등록 뒤. RevenueCat으로 애플·구글 구독을 받고 웹훅으로 `profiles.plan = 'plus'`, `premium_until`을 바꾼다. 웹은 토스페이먼츠 정기결제. 정리된 사실(2026-10-10): 토스페이먼츠 같은 국내 PG는 사업자등록이 필수다. 스토어 인앱결제는 개인 개발자 계정으로도 되지만 수익은 소득 신고 대상이라 결국 간이과세자 등록을 권한다. 사용자는 직장인이라 회사 겸업 규정 확인이 먼저다.

## 5. 사용자가 준비할 것

| 할 일 | 필요한 단계 | 메모 |
| --- | --- | --- |
| ~~Android Studio 설치(SDK·에뮬레이터 포함)~~ | 1 | 이미 있음(SDK는 Homebrew 것을 씀, 2장). JDK는 내장 것 사용 |
| 맥 방화벽에서 node의 들어오는 연결 허용 | 1(실기기) | 시스템 설정 > 네트워크 > 방화벽 > 옵션. 실기기가 `http://<LAN IP>:3100`에 닿으려면 필요 |
| 애플 App ID `kr.maengo.app`에 Sign in with Apple·Push 켜기, 키 `XKH9RW6Y9W`에 APNs가 켜졌는지 확인(안 켜졌으면 새 키) | 2·3 | |
| Firebase 프로젝트(Google Cloud `maengo` 프로젝트 선택) + iOS·Android 앱 등록 → 설정 파일 두 개 | 2·3 | API_KEYS.md 4번 |
| APNs 인증 키를 Firebase에 업로드 | 3 | |
| Firebase 서비스 계정 JSON → Vercel 환경 변수 `FIREBASE_SERVICE_ACCOUNT_JSON` | 3 | 값은 대화에 붙이지 말고 직접 넣는다 |
| Google Cloud에 iOS·Android OAuth 클라이언트 ID(안드로이드는 SHA-1 필요) | 2 | Supabase 구글 제공자에 추가 |
| Google Play 개발자 계정($25, 개인) | 5 | 신원 확인에 며칠 걸릴 수 있다 |
| 비공개 테스터 12명 모으기 | 5 | 14일 연속 참여 |

## 6. 위험과 대응

| 위험 | 대응 |
| --- | --- |
| 애플 4.2: 웹을 감싼 앱으로 거절 | 네이티브 로그인·푸시·백그라운드 듣기·공유·햅틱을 갖추고 심사 메모에 적는다. 거절되면 오프라인 저장을 붙인다 |
| 구글이 웹뷰 로그인을 막음 | 2단계 네이티브 로그인(대안: 시스템 브라우저 + 딥링크) |
| WKWebView 쿠키가 앱 재시작 후 사라짐 | 2단계 완료 기준에서 확인. 사라지면 세션을 Capacitor Preferences에 두고 시작할 때 쿠키로 되돌리는 방법을 검토 |
| 안드로이드 백그라운드 재생이 끊김 | 4단계에서 확인 후 네이티브 오디오로 교체 |
| 웹 배포가 곧 앱 배포 | 앱에서 깨질 수 있는 웹 변경은 앱 실기기로도 확인한 뒤 배포한다 |
| Play 14일 테스트로 출시가 늦어짐 | 비공개 테스트를 일찍 시작 |

## 7. 환경 변수(추가분)

| 변수 | 쓰는 곳 | 용도 |
| --- | --- | --- |
| `CAP_SERVER_URL` | apps/mobile(빌드 때) | 개발 때 띄울 웹 주소. 없으면 운영 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | web(서버, Vercel) | 푸시 보내기. Vercel 운영에 넣어 둠(2026-10-11). 로컬은 `FIREBASE_SERVICE_ACCOUNT_PATH=~/.maengo/firebase-admin.json` |
| `NEXT_PUBLIC_FIREBASE_*`(5개) | web | 웹 푸시용 Firebase 설정. `.env.local`·Vercel 운영에 넣어 둠(2026-10-11) |
| `CRON_SECRET` | web(서버), Supabase cron | `/api/cron/notify` 보호 |
| `APPLE_BUNDLE_ID=kr.maengo.app` | web(서버) | 이미 `.env.local`에 있음. 네이티브 애플 로그인 검증 |
