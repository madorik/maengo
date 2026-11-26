# 스토어 스크린샷·등록 정보

버전을 올릴 때 스크린샷과 설명을 다시 만들고 두 스토어에 올리는 스크립트. 문구는 `apps/mobile/STORE.md`에서 읽는다.

준비: 이 폴더 밖 임시 폴더에 `npm i playwright-core@1.56.1`(설치된 Chrome을 쓴다), 스크립트를 그 폴더로 복사해서 실행한다.

1. 웹을 운영 빌드로 로컬에 띄운다(데모 로그인은 `.env.local`의 `DEMO_USER_ID`): `apps/web`에서 `npx next build && npx next start -p 3100`
2. 원본 화면: `node raw.mjs <원본폴더> 393 852 3 ios`, `node raw.mjs <원본폴더> 360 800 3 android`
3. 스토어 이미지: `node compose.mjs <원본폴더> <결과폴더> apps/web/app/icon.svg` → iOS 1290×2796(6.7인치) 6장, Android 1080×1920 6장, Play 그래픽 1024×500
4. 지금 상태 보기(읽기만): `node inspect.mjs`
5. 올리기: `node upload.mjs <결과폴더> apps/mobile/STORE.md <512 아이콘> [play|asc]`
   - App Store Connect: 제출 준비 중인 버전의 설명·키워드·홍보 문구·URL, 부제·처리방침, 6.7인치 스크린샷 세트를 새로 채운다
   - Play: 한국어 등록정보·연락처·휴대전화 스크린샷·그래픽·아이콘. 서비스 계정에 '스토어 등록정보 관리' 권한이 있어야 커밋된다

6. 빌드 올리기: `node release.mjs <aab> [트랙=internal] [출시 노트]`(Play), `node release.mjs --ios`(iOS 빌드 처리 상태. 올리기는 xcodebuild -exportArchive)
7. 인앱 상품(App Store Connect): `node asc-products.mjs`, 심사용 스크린숏 `node asc-products.mjs --shot <구독 화면 png> <묶음 화면 png>`
8. 인앱 상품(Play): `node play-products.mjs`(판매자 계정이 있어야 한다)

키는 모두 저장소 밖 `~/.maengo/`에 있다: App Store Connect API 키(`AuthKey_<키 ID>_Connect.p8`)와 키 ID·Issuer ID·앱 ID(`store-api.json`), Play 서비스 계정 JSON(`play-service-account.json`). 공개 저장소라 값은 여기 적지 않는다.

### 2026-11-10 개편판에서 쓴 방법
- 원본: 운영 빌드 대신 **로컬 개발 서버(:3000, 로컬 DB 데모 계정)**에서 `node raw2.mjs <원본폴더> 393 852 3 ios <main|pm|onboarding>`(안드로이드는 `360 800 3 android`).
  - 개발 표시(N)는 숨긴다.
  - `pm`은 `.env.development.local`의 `DEV_BRIEFING_SLOT=pm`, `onboarding`은 데모 계정 `onboarded_at`을 비운 뒤 찍는다.
  - 맹고 AI 화면과 주간 리포트 정리에 Gemini가 필요하다. 찍는 동안만 개발 서버에 키를 넣었다.
- iOS 새 버전: `node asc-version.mjs 1.3.3 "<새 기능>"`(제출 준비 중 버전을 만든다) → `upload.mjs … asc` → 빌드 처리 확인 `node asc-build-state.mjs 10`(읽기만)

### 2026-11-11 (1.3.4) 바꾼 것
- 원본은 `raw3.mjs`(raw2에서 듣는 중 오늘 화면 `playing` 추가, 물어보기는 예상 질문 칩 화면, 플레이어 창·'찾았어요' 뺌). 첫 소식은 예상 질문이 로컬 DB에 있어 Gemini를 부르지 않는다
- 퇴근길(`pm`)은 그날 로컬 퇴근길 피드가 있어야 한다. 없으면 전날 퇴근길 피드를 오늘로 잠깐 복사하고 `feed_days.visible`을 20으로 둔 뒤 찍고 되돌린다
- iOS는 출시된 버전의 스크린샷·설명을 못 바꾸므로 새 버전 + 새 빌드: pbxproj의 `MARKETING_VERSION`·`CURRENT_PROJECT_VERSION`을 올리고 archive → exportArchive(업로드) → `asc-build-state.mjs 11` → `asc-version.mjs` → `upload.mjs … asc` → `asc-submit.mjs 1.3.4 11`. Play는 빌드 없이 `upload.mjs … play`


### 2026-11-26 (1.3.6) 새 아이콘·새 화면, 설명 '제작 계기 + 주요 기능'판
- 원본은 `raw5.mjs <원본폴더> <w> <h> <3> <ios|android> <main|pm|onboarding>`(개발 서버 :3200, `PORT`로 바꾼다). iOS `393 852`, 안드로이드 `360 800`. 찍는 화면: 소식 상세(article, 핵심 요약), 오늘(today, 인사이트 제목+흐름 카드), 흐름 상세(flow, 맹고 분석), 주간 리포트(report, Premium), 플레이어(listen, 시간 표시 없음), 물어보기(ask, 예상 질문 칩), 보관함(library), 온보딩(pick), 퇴근길 오늘(today-pm). 앞의 6개가 스토어 6장, 나머지는 소개 페이지 사진.
- 개발 DB(로컬 Supabase)에서만 데모 상태를 바꾼다(찍은 뒤 되돌린다): `profiles.plan='plus'`·`premium_until`(리포트·듣기 Premium 화면), `display_name='지민'`, 오늘 날짜 `feeds`·`feed_days`·`briefing_insights`를 지난 날(11-24 am) 것으로 복사(오늘 소식 오기 전 화면이 아니라 채워진 홈), 오늘 소식의 `reads` 비우기(읽음 흐림 없이), 온보딩은 `onboarded_at` 비우기, 퇴근길은 11-25 am 피드·인사이트를 오늘 `slot='pm'`(rank 11~20, `visible` 20)으로 복사하고 `.env.development.local`의 `DEV_BRIEFING_SLOT=pm`(파일만 고치면 개발 서버가 다시 읽는다. 끝나면 `am`으로). 플랜을 바꾸면 `plan_changes`에 줄이 생기고 듣기·읽기는 `user_topics` 비중·`usage_log`를 바꾸니 지운다(찍기 전 CSV로 받아 두고 되돌렸다)
- 듣기 화면: 개발 서버도 처음 듣는 소식은 TTS로 만들어 `audio_segments`에 남긴다(R2). 맹고 AI 예상 질문은 로컬 DB에 질문이 이미 있는 소식(우리투자증권 공모채)으로 열어 Gemini를 안 부른다
- 스토어 이미지: `node compose.mjs <원본폴더> <결과폴더> apps/web/app/icon.svg`. 순서는 설명 차례(핵심 요약 → 흐름 → 영향 → 주간 리포트 → 듣기 → 맹고 AI). 안드로이드는 폰 아래가 잘려서 폭을 조금 좁혔고, 원본도 그에 맞춰 article은 80px 내려 찍고 ask는 높이 680으로 찍는다
- Play 아이콘: `apps/mobile/assets/icon-only.png`를 512×512로 줄여 `icon-512.png`
- 소개 페이지 사진 8장(`apps/web/components/landing/app-*.webp`, 600×1301)은 같은 iOS 원본을 `sharp`로 줄인 것(today·today-pm·listen·article·ask·found(온보딩 pick)·library·report). 회사 소개 `apps/company/img/maengo-today·maengo-pm·maengo-listen.webp`는 today·today-pm·listen의 복사본이다
