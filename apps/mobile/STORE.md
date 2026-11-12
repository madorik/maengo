# 맹고 스토어 등록(비공개 테스트까지)

> 2026-10-11 작성, 2026-10-17 1.2 출시용으로 고침(유료 플랜·공유·백그라운드 재생). 콘솔에 그대로 붙여 넣을 문구와 답, 순서. 주소는 회사 도메인 아래 `https://watalabs.com/maengo`(2026-10-17부터, 개발자 웹사이트는 `https://watalabs.com`). 그래픽·스크린샷·AAB는 저장소 밖 `~/Desktop/maengo-store/`, `~/Desktop/maengo-1.0.0-1.aab`에 있다(다시 만드는 법은 맨 아래).

## 공통 정보

| 항목 | 값 |
| --- | --- |
| 앱 이름(홈 화면) | 맹고 |
| 스토어 제목(Play 제목·App Store 이름, 30자) | 맹고 - 뉴스 읽어주는 앱, AI 뉴스 요약 |
| 부제(App Store, 30자) | 내 관심 분야 소식, 오늘 뉴스 핵심 요약 |
| 패키지·번들 ID | `kr.maengo.app` |
| 카테고리 | 뉴스 및 잡지(Play) / 뉴스(App Store) |
| 연락처 이메일 | watalabs.help@gmail.com |
| 웹사이트(개발자) | https://watalabs.com |
| 개인정보 처리방침 | https://watalabs.com/maengo/privacy |
| 이용약관 | https://watalabs.com/maengo/terms |
| 계정 삭제 안내(Play) | https://watalabs.com/maengo/delete-account |
| 가격 | 무료(앱 안 결제 있음: Premium 월 ₩3,800 자동 갱신 구독·첫 구독 7일 무료. 맹고 묶음 10·30·50·100은 2026-11-12 판매 중지(packs-off.mjs). [BILLING.md](BILLING.md)) |
| 키워드(App Store, 100자) | 재테크,인사이트,주식,증시,시황,미국주식,코인,부동산,청약,대출,금리,환율,경제,경제신문,반도체,브리핑,듣기,오디오,팟캐스트,출근길,출퇴근,직장인,헤드라인,ETF |

### 짧은 설명(Play, 80자 이내)
내 관심 분야 소식, 오늘 뉴스 핵심 요약. AI가 골라 요약하고 출근길엔 귀로 들려줘요.

### 전체 설명(Play 전체 설명 / App Store 설명)
맹고는 뉴스 읽어주는 앱이에요.
내 관심 분야 뉴스만 골라 AI가 요약하고, 그 뉴스가 나에게 어떤 영향을 줄지 짚어 줘요.
출근길·퇴근길엔 귀로 들으면 돼요.


■ 이런 분께 맞아요

• 관심 분야 뉴스는 챙기지만, 다 읽을 시간은 없는 직장인
• 뉴스를 읽고도 "그게 나한테 어떤 영향을 주지?"가 남는 분
• 운전 중이거나 만원 지하철이라 화면을 보기 어려운 출퇴근길
• 같은 사건을 여러 기사로 되풀이해 읽는 게 지친 분


■ 맹고가 하는 일

▶ 관심 분야 뉴스만, 짧게
읽고 듣는 뉴스에 맞춰 관심 분야를 찾고, 그 안에서 이슈도가 높은 뉴스만 골라 핵심만 요약해요.
같은 사건은 하나로 묶고, 요약마다 언론사와 원문 링크를 남겨요.
해외 매체 글도 한국어로 요약해요.

▶ 그게 나한테 어떤 영향을 주지? 맞춤 인사이트
오늘 받은 뉴스를 하나의 흐름으로 엮고, 그 뉴스가 나에게 어떤 영향을 줄지 짚어 줘요.
예) 자주 보는 반도체 소식: 수출이 늘었다는 소식은 반도체 기업의 실적 전망과 함께 볼 만해요.
내 상황을 알려 주면 더 맞춰져요. 사거나 팔라는 말은 하지 않아요.

▶ 출근길·퇴근길 하루 두 번, 귀로 듣기
아침과 오후에 브리핑이 와요.
브리핑 듣기를 누르면 화면을 꺼도 다음 뉴스까지 이어서 읽어 줘요.

▶ 한 주를 정리하는 주간 리포트 (Premium)
한 주 동안 본 뉴스를 분야별로 정리하고, 다음 주 지켜볼 것까지 짚어 줘요.


■ Free와 Premium

Free
• 브리핑마다 뉴스 10개
• 음성 듣기 하루 3개
• 맞춤 인사이트

Premium (월 3,800원, 첫 구독 7일 무료)
• 음성 듣기 무제한, 더 자연스러운 AI 목소리
• 주간 리포트

Premium은 매달 자동으로 갱신돼요.
갱신 24시간 전까지 App Store·Google Play의 구독 관리에서 해지하지 않으면 다음 달 요금이 결제돼요.
무료 체험 중에 해지하면 결제되지 않아요.

이용약관(EULA): https://watalabs.com/maengo/terms
개인정보 처리방침: https://watalabs.com/maengo/privacy

### 출시 노트(1.3.5, 2026-11-12)
• 오늘 화면 머리말을 '오늘 뉴스 핵심 요약'으로 바꿨어요
• 맞춤 인사이트를 만드는 동안 분석 중이라고 알려 드려요
• 소개 문구를 다듬었어요

### 출시 노트(1.3.4, 2026-11-11)
• 오늘 화면에서 바로 들어요. 노선 위 맹고가 지금 듣는 소식을 따라가요
• 맹고를 옮기거나 카드의 재생 버튼을 누르면 그 소식부터 들어요. 처음부터 다시 듣기도 있어요
• 물어보기: 예상 질문을 골라 바로 물어봐요
• 소개 이미지를 새로 바꿨어요

### 출시 노트(1.3.2, 2026-11-08)
• 앱 이름과 소개 이미지를 새로 바꿨어요

### 출시 노트(1.3.0, 초안)
맹고 1.3.0이에요.
• 맹고 AI: 소식을 읽다 궁금한 건 글이나 말로 물어보세요. 읽던 소식을 바탕으로 핵심부터 답해 드려요
• 홈 화면 위젯이 생겼어요. 오늘 받은 소식 제목을 홈 화면(아이폰은 잠금 화면도)에서 보고, 누르면 그 소식이 열려요
• Free도 하루 1개는 '이 글 듣기'로 들을 수 있어요
• 처음 시작할 때 알림을 켜서 소식이 오면 바로 알려 드려요
• 소식을 공유하면 받은 사람이 앱 없이도 요약을 볼 수 있어요
• 소식 화면에서 좌우로 밀어 이전·다음 소식으로 넘겨요

### 출시 노트(1.2.1, 초안)
맹고 1.2.1이에요.
• 화면을 끄거나 다른 앱을 써도 듣기가 이어져요. 잠금 화면과 알림에서 멈추고 넘길 수 있어요
• 소식을 공유할 수 있어요
• 다크 모드를 지원해요(설정 > 화면)
• 보관함에서 지난 소식을 검색할 수 있어요
• 설정에서 문의하기와 앱 버전을 볼 수 있어요
• 앱에서 Premium을 구독(첫 구독 7일 무료)하고 맹고를 추가로 살 수 있어요
• 앱을 열 때 뜨는 첫 화면을 새로 그렸어요. 맹고가 이어폰을 끼고 오늘의 소식을 들어요

### 출시 노트(1.1.0, 2026-10-14)
맹고 1.1.0 테스트 버전이에요. 앱 알림(정한 시각에 오늘의 소식 알림), 하루 소식보다 더 받기(지갑의 맹고), Premium 안내 페이지가 들어갔어요. 써 보시고 불편한 점은 watalabs.help@gmail.com으로 알려 주세요.

### 출시 노트(첫 버전)
맹고 첫 비공개 테스트 버전이에요. Google·Apple 계정으로 바로 시작할 수 있어요.

## Android — Google Play 비공개 테스트

1. **앱 만들기**: Play Console > 앱 만들기. 앱 이름 `맹고`, 기본 언어 `한국어 – ko-KR`, 앱, 무료, 선언 두 개 체크
2. **앱 콘텐츠**(대시보드 > 앱 설정): 아래 '앱 콘텐츠 답' 대로
3. **기본 스토어 등록정보**: 위 짧은 설명·전체 설명, 앱 아이콘 `icon-512.png`, 그래픽 이미지 `feature-1024x500.png`, 휴대전화 스크린샷 `phone-1~5.png`(1080×1920). 카테고리 뉴스 및 잡지, 연락처 이메일·웹사이트
4. **테스터 그룹**(누구나 링크로 참여): https://groups.google.com 에서 그룹 만들기 → 이름 `맹고 테스터`, 이메일 예 `maengo-testers@googlegroups.com`, 공개 범위 '웹의 모든 사용자', 참여 '누구나 그룹에 참여 가능'
5. **비공개 테스트 트랙**: 테스트 및 출시 > 테스트 > 비공개 테스트 > (기본 트랙 'Closed testing - Alpha') > 테스터 탭 > Google 그룹에 위 그룹 이메일 추가 > 피드백 이메일 watalabs.help@gmail.com > 저장
6. **버전 만들기**: 같은 트랙 > 새 버전 만들기 > Play 앱 서명은 '계속'(Google이 앱 서명 키를 관리, 우리는 업로드 키로 서명) > `maengo-1.0.0-1.aab` 업로드 > 출시 노트 > 검토 > 출시 시작
7. 구글 검토가 끝나면(몇 시간~며칠) 테스터 탭의 **'웹에서 참여' 링크**가 열린다. 테스터는 ① 그룹 가입 ② 참여 링크에서 '테스터 되기' ③ Play 스토어에서 설치
8. 프로덕션 출시 조건(개인 계정): 테스터 12명 이상이 14일 연속 참여

### 앱 콘텐츠 답

| 항목 | 답 |
| --- | --- |
| 개인정보처리방침 | https://watalabs.com/maengo/privacy |
| 앱 액세스 권한 | '모든 기능 또는 일부 기능이 제한됨' → 안내: "Google 계정 또는 Apple 계정으로 로그인하면 바로 가입됩니다(어떤 Google 계정도 가능, 따로 드릴 아이디·비밀번호 없음). 처음 들어오면 관심 분야를 고르고 '오늘 맹고 받기'를 누르면 소식이 나옵니다." |
| 광고 | 광고 없음 |
| 콘텐츠 등급 | 이메일 watalabs.help@gmail.com, 카테고리 '참고 자료, 뉴스 또는 교육'. 폭력·성적 콘텐츠·욕설·약물·도박 모두 아니요. 사용자 간 소통·콘텐츠 공유 아니요(공유 버튼은 기기의 공유 시트로 원문 링크를 보낼 뿐, 앱 안에서 사용자끼리 주고받지 않음), 위치 공유 아니요, 디지털 구매 예(앱 안 결제: Premium 구독·맹고 묶음, 2026-10-14). 등급은 전체 이용가(애플 4+) |
| 타겟층 | 13~15세, 16~17세, 18세 이상(약관상 가입은 만 14세 이상, 콘텐츠 등급은 전체 이용가 — 2026-10-14 사용자 결정). 아동에게 어필하지 않음 |
| 뉴스 앱 | 예. 발행자 = 운영자 정민균, 연락처 watalabs.help@gmail.com, 웹사이트 https://watalabs.com/maengo. 소식마다 원문 출처를 표시함 |
| 정부·금융·건강 앱 | 모두 아니요 |
| 포그라운드 서비스 권한(1.2부터) | 미디어 재생(`FOREGROUND_SERVICE_MEDIA_PLAYBACK`). 설명: "사용자가 재생을 누른 소식 음성을 화면을 끄거나 다른 앱을 쓰는 동안에도 이어서 들려 줍니다. 재생하는 동안만 켜지고 알림에 재생 조작 버튼이 보입니다." 시연 영상: 듣기 → 홈으로 나가도 재생 → 알림에서 일시정지(30초) https://watalabs.com/maengo/demo/background-playback.mp4 (에뮬레이터 녹화, `apps/web/public/demo/`) |
| 데이터 보안 | 아래 |

### 데이터 보안 답(1.2 기준, 2026-10-18 고침)
- 수집: 예 / 공유(제3자 제공): 아니요(Google 애널리틱스·RevenueCat·Firebase는 처리 위탁이라 '공유'가 아님) / 전송 중 암호화: 예 / 계정 만들기: 예(Google·Apple 로그인), 계정 삭제 URL https://watalabs.com/maengo/delete-account(앱 안 설정 > 계정 삭제도 됨)
- 수집하는 데이터(모두 '수집', 일시적 처리 아님)
  - 개인 정보: 이름, 이메일 주소 — 필수, 앱 기능·계정 관리 / 사용자 ID — 필수, 앱 기능·계정 관리
  - 금융 정보: 구매 기록(Premium 구독·맹고 추가 구매) — 선택(산 사람만), 앱 기능
  - 앱 활동: 앱 상호작용(읽음·들음·좋아요/싫어요·화면 이용) — 필수, 앱 기능·분석·맞춤설정(피드 고르기) / 앱 내 검색 기록(보관함 검색어, 화면 주소에 실려 애널리틱스에도 남음) — 선택, 앱 기능·분석 / 기타 사용자 생성 콘텐츠(관심사 '기타'에 적은 말, 내 관심 링크 주소) — 선택, 앱 기능·맞춤설정
  - 기기 또는 기타 ID: 알림 토큰(FCM)·애널리틱스 기기 식별값 — 필수, 앱 기능·분석
- 수집하지 않음: 위치, 건강, 연락처, 사진·동영상, 오디오, 파일, 캘린더, 메시지, 웹 기록, 비정상 종료 로그·진단
- 광고 ID: 쓰지 않음(병합 매니페스트에 AD_ID 권한 없음, 10-18 확인)

### 애플 개인정보 라벨(App Store Connect > 앱 개인정보 보호)
- 추적: **아니요**. GA4에서 Google 신호·광고 개인화를 끈 상태여야 한다(켜면 '추적'이 돼 ATT 권한 창이 필요)
- 사용자에게 연결된 데이터(모두 '추적에 사용'은 아니요)

| 유형 | 항목 | 목적 | 신원에 연결 |
| --- | --- | --- | --- |
| 연락처 정보 | 이름, 이메일 주소 | 앱 기능 | 예 |
| 식별자 | 사용자 ID | 앱 기능, 분석 | 예 |
| 식별자 | 기기 ID(알림 토큰) | 앱 기능 | 예 |
| 구입 항목 | 구입 내역 | 앱 기능 | 예 |
| 사용 데이터 | 제품 상호작용 | 앱 기능, 분석, 제품 개인화(피드 고르기) | 예 |
| 검색 기록 | 검색 기록(보관함 검색어가 화면 주소에 실려 GA에 남음) | 분석 | 예(GA에 회원 ID) |
| 사용자 콘텐츠 | 기타 사용자 콘텐츠(관심사 '기타', 내 관심 링크 주소) | 앱 기능, 제품 개인화 | 예 |
| 진단 | 충돌 데이터(Sentry, 앱 화면 오류도 잡음) | 앱 기능 | 아니요(Sentry에 회원 정보 안 넣음) |

2026-10-31 1.3 제출 때 위 표로 답함(검색 기록·진단·제품 개인화를 더함).

### 앱 심사 메모(App Store 심사 정보 > 메모, 1.2)
App Review 팀이 영어로 읽는다. 연락처(이름·전화·이메일)는 따로 넣는다.

```
Maengo is a personalized news briefing app for Korean users. Sign in with Apple or Google creates an account instantly (no demo account needed). After choosing topics on the first screen, tap "오늘 맹고 받기" to receive today's news summaries.

Native features beyond the web content:
- Push notifications: daily delivery alert at the time the user sets (Settings > 알림).
- Background audio: summaries are read aloud by text-to-speech; playback continues with the screen locked or while using other apps, with lock-screen / Control Center controls (Now Playing). (Premium feature; the 7-day free trial can be started in the sandbox.)
- In-App Purchase: Premium monthly auto-renewable subscription (7-day free trial) and consumable "맹고" packs, with Restore Purchases and Manage Subscription in Settings > 플랜.
- Sign in with Apple, and account deletion inside the app (Settings > 계정 삭제).
- Native share sheet on each article (top-right share button).

Content: summaries of public news articles and official blogs, each linking to the original source.
```

## iOS — TestFlight 공개 링크

1. **Xcode에 Apple 계정 로그인**: Xcode > Settings > Accounts > + > Apple ID(개발자 계정). 이게 있어야 서명·업로드를 명령줄로 할 수 있다
2. (Claude) 아카이브 → 이때 App ID `kr.maengo.app`이 자동 등록된다
3. **App Store Connect 앱 만들기**: 앱 > + > 신규 앱. 플랫폼 iOS, 이름 `맹고`, 기본 언어 한국어, 번들 ID `kr.maengo.app`, SKU `maengo-ios`, 사용자 액세스 전체
4. (Claude) 빌드 업로드 → 처리 10~30분
5. **TestFlight > 테스트 정보**: 베타 앱 설명(위 짧은 설명), 피드백 이메일 watalabs.help@gmail.com, 마케팅 URL https://watalabs.com/maengo, 개인정보 처리방침 URL
6. **베타 앱 검토 정보**: 연락처(이름·전화·이메일), '로그인 필요' 체크 해제, 메모: 위 '앱 심사 메모'를 그대로 쓴다
7. **외부 그룹**: TestFlight > 외부 테스팅 + > 그룹 이름 `베타 테스터` > 빌드 추가 > 검토 제출(보통 1~2일)
8. 승인되면 그룹의 **공개 링크 활성화** → 링크를 나눠 준다. 테스터는 TestFlight 앱을 깔고 링크로 설치
- 내부 테스터(App Store Connect 사용자, 검토 없음)로 먼저 깔아 보려면 TestFlight > 내부 테스팅 그룹에 본인을 넣는다

## 버전 올리기
- 웹 화면은 배포하면 앱에도 바로 반영된다(스토어 심사 없음). 앱을 다시 올리는 건 네이티브 코드·설정이 바뀔 때만
- Android: `android/app/build.gradle`의 `versionCode`를 1씩 올리고 `versionName`도 맞춘다
- iOS: Xcode 프로젝트의 `CURRENT_PROJECT_VERSION`(빌드 번호)을 올린다. 같은 번호는 다시 못 올린다

## 다시 만드는 법
- 공통: `apps/mobile`에서 `npx cap sync`(CAP_SERVER_URL 없이 = 운영 주소)
- Android AAB: `cd android && ANDROID_HOME=/opt/homebrew/share/android-commandlinetools JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease` → `app/build/outputs/bundle/release/app-release.aab`. 업로드 키는 `~/.maengo/maengo-upload.jks`(+ `upload-keystore.properties`), **잃지 않게 백업**(잃으면 Play Console에서 업로드 키 재설정 요청)
- iOS: `cd ios/App && xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath <경로>.xcarchive -allowProvisioningUpdates archive` → `xcodebuild -exportArchive`(ExportOptions: method app-store-connect, destination upload, teamID QYS79FM739). 처리 상태는 `node scripts/store/release.mjs --ios`(10~30분 뒤 VALID). 내부 테스터 그룹은 '모든 빌드'라 처리되면 바로 받는다
- Play 업로드: `node scripts/store/release.mjs <aab> internal "<출시 노트>"` → 내부 테스트 트랙에 새 출시(완료). 다른 트랙은 두 번째 인자(alpha = 비공개 테스트, production). 이미 올린 빌드를 다른 트랙에 낼 때는 AAB 대신 버전 코드(`release.mjs 3 alpha …`). 앱이 '초안 앱'(등록정보·앱 콘텐츠 미완)이면 내부 테스트 말고는 초안으로만 들어간다
- 인앱 상품(App Store Connect): `node scripts/store/asc-products.mjs`(BILLING.md 상품 표대로 구독 그룹·구독·가격·1주 무료 체험·묶음 4개, 이미 있으면 건너뜀) → `node scripts/store/asc-products.mjs --shot <구독 화면> <묶음 화면>`(심사용 스크린숏, 시뮬레이터 `/premium`)
- 그래픽: 아이콘은 `assets/icon-only.png`를 512로 줄인 것. 스크린샷·그래픽 이미지는 `scripts/store/`로 만들고 올린다(README). 2026-10-18 판(1.2 화면, 하루 소식 3·10 되돌린 뒤, 데모 계정 Premium·관심사 4개)은 `~/Desktop/maengo-store/2026-10-18/`
- 2026-10-17 올린 상태: **App Store Connect** 버전 1.0(제출 준비 중)에 설명·키워드·홍보 문구·지원/마케팅 URL·부제·처리방침 URL·6.7인치 스크린샷 6장 완료. **Play**는 서비스 계정 권한 부족(403)으로 커밋 실패 → Play Console > 사용자 및 권한 > Play 업로드용 서비스 계정(`~/.maengo/play-service-account.json`의 client_email) > 앱 권한에 '스토어 등록정보 관리' 추가 후 `upload.mjs … play` 다시
- 2026-10-18 올린 상태: **Android 1.2.0(versionCode 3)** 내부 테스트 출시 완료, **비공개 테스트(alpha)**는 처음엔 초안('초안 앱')이었다가, 사용자가 앱 콘텐츠를 다 채우고 검토 제출(같은 날, 국가 대한민국). 사용자 결정(10-18): Play는 개인 계정 그대로, 12명·14일 비공개 테스트로 간다. **iOS 1.2.0(빌드 3)** 처리 끝(VALID), 내부 테스터 배포, '테스트할 내용' 1.2 출시 노트. App Store 버전을 1.0 → **1.2.0**으로 바꾸고 빌드 3을 붙임. 6.7인치 스크린샷 6장을 10-18 판으로 바꿈. 인앱 상품 5개(구독 ₩3,800·1주 무료, 묶음 ₩1,100·2,900·4,400·7,900) 제출 준비 완료. **남은 것**: 앱 심사 정보(연락처 이름·전화, 메모는 위 '앱 심사 메모'), 가격 및 사용 가능 여부(무료·판매 국가), 앱 개인정보(위 라벨), 연령 등급, 버전 화면의 '앱 내 구입 및 구독'에 상품 5개 선택. Play 등록정보(설명·연락처·스크린샷 6장·그래픽·아이콘)는 권한 받은 뒤 올림(10-18)
- 2026-10-23 올린 상태: 첫 화면(스플래시) 교체로 **1.2.1(Android versionCode 4, iOS 빌드 4)**. Play 내부 테스트 완료, 비공개 테스트(alpha)도 1.2.0(3) 대신 1.2.1(4)로 바꿔 냄. iOS 빌드 4 업로드, App Store 버전 이름을 1.2.0 → **1.2.1**로 바꾸고 빌드 4(VALID)를 붙임, TestFlight '테스트할 내용'은 위 1.2.1 출시 노트
- 2026-10-23 밤 1.3.0: **Android versionCode 6** Play 내부 테스트·비공개 테스트(alpha) 출시 완료(출시 노트는 위 1.3.0). **iOS 빌드 6은 아카이브 실패**: 새 App Group(`group.kr.maengo.app`)과 위젯 번들 ID(`kr.maengo.app.widget`)를 등록해야 하는데 Xcode에 계정이 없고, ASC API 키(8MTQYTB587)로 `-authenticationKey*`를 주면 "Authentication failed"(프로비저닝 권한 없음, Admin 키가 필요한 듯). Xcode > Settings > Accounts에 팀 QYS79FM739 계정을 넣은 뒤 위 iOS 명령(`-allowProvisioningUpdates`)으로 다시 하면 그룹·번들 ID·프로필이 자동으로 만들어진다
- 2026-10-31 올린 상태: 스크린샷·설명을 1.3 화면으로 새로(캡처: 오늘·요약과 원문·듣기·내 관심 링크·보관함·다크, 문구는 핵심 가치 기준). **App Store** 설명·홍보 문구·6.7인치 6장 완료, 카테고리 뉴스, 저작권 '2026 와타랩스', 가격 무료(기준 국가 대한민국), 판매 국가 대한민국만, 제3자 콘텐츠 '예(권리 있음)', 앱 심사 정보(연락처·메모) 완료. **Play** 등록정보 커밋은 403 "한국 법에 따라 계정 세부정보에 추가 정보" → Play Console 개발자 계정 세부정보를 채운 뒤 `upload.mjs … play` 다시
- 2026-11-08 올린 상태: 스토어 이미지를 출시 홍보 이미지 디자인(앱 화면을 HTML로 다시 그린 판, 장마다 다른 바탕)으로 바꿈. 순서 첫 장·듣기·맹고 AI·관심 분야·요약과 원문·이슈도 순서, 6장. 날짜 배지·다른 플랫폼 이름·둘러보기 안내는 뺌. 원본 `~/Desktop/maengo-store/2026-11-08/`, 만든 스크립트 `src/`. **Play** 휴대전화 스크린샷 8 → 6장 교체 커밋(검토). **iOS 1.3.2(빌드 9)**: 네이티브 변경 없이 버전만 올림, 이름 `맹고 - 관심 분야 소식만, AI 요약·음성 듣기`·부제 `영어 소식도 한국어로, 원문 출처까지`·6.7인치 6장·설명(STORE.md 최신, Free 5·듣기 3) 반영. 내보내기는 API 키로 하면 'Cloud signing permission error'라 Xcode 로그인 계정으로(-allowProvisioningUpdates만)
- 2026-11-10 개편판: 하루 두 번 브리핑·관심사 찾기·주간 리포트로 설명을 고치고(내 관심 링크·관심사 고르기 줄은 뺌) 스토어 이미지 8장을 새로 만듦(원본 `~/Desktop/maengo-store/2026-11-10-raw/`, 결과 `2026-11-10/`, 캡처 `scripts/store` README의 raw 대신 로컬 개발 서버 + raw2). 순서 출근길·퇴근길·플레이어·맹고 AI·관심사 찾기·요약과 원문·보관함·주간 리포트. **Play** 등록정보·이미지 올림. **iOS**는 1.3.2가 판매 중이라 다음 버전에서 반영
- 2026-10-31 10:32 **iOS 1.3.0(빌드 6) 심사 제출**: 버전 + 구독(Premium) + 맹고 묶음 4개를 한 제출로(WAITING_FOR_REVIEW). 위젯은 뺀 빌드. 유료 앱 계약 맺음, 앱 개인정보 라벨 게시(위 표). 첫 인앱 상품은 API로 따로 제출이 안 되고(FIRST_CONSUMABLE_MUST_BE_SUBMITTED_ON_VERSION) 버전 화면에서 고른 뒤 같은 제출 묶음에 버전을 넣어 냈다. 승인되면 바로 출시(AFTER_APPROVAL)
- 2026-11-04 1.3.0 반려(2.1(b), 구독 화면 '스토어를 불러오지 못했어요') → 원인은 유료 앱 계약 '사용자 정보 대기 중'(은행·세금). 계약 활성 뒤 **iOS 빌드 7**(맹고 AI 말로 묻기 플러그인 포함, 위젯 없음)을 올려 1.3.0에 붙이고, 해결 필요(UNRESOLVED_ISSUES)로 남은 기존 제출 묶음을 `PATCH /v1/reviewSubmissions/{id}` `submitted: true`로 그대로 다시 냄(인앱 5개도 같이 WAITING_FOR_REVIEW). 아카이브는 샌드박스 안에서 돌리면 SwiftPM 매니페스트 컴파일이 실패한다
- 2026-11-04 **Android 1.3.0(versionCode 7)**: 맹고 AI 말로 묻기 플러그인·RECORD_AUDIO 포함. 내부 테스트·비공개 테스트(alpha) 출시(출시 노트는 위 1.3.0, 맹고 AI 줄 더함). Play 등록정보는 글만 다시 올림(맹고 AI 줄, Free·Premium 질문 횟수), 이미지는 10-31 판 그대로
- 2026-11-04 Play 계정 세부정보(한국 법)에 전자상거래 라이선스 번호 `제2026-서울서초-3688호`(통신판매업 신고번호)·대행사 `서울특별시 서초구청`을 넣음(사용자)
- 2026-10-31 계정 세부정보(한국 법) 채운 뒤 **Play 등록정보** 커밋 완료(설명·스크린샷 6장·그래픽 이미지·아이콘). 프로덕션 트랙에 1.3.0(vc6)을 넣으면 400 FAILED_PRECONDITION: 프로덕션 액세스 권한 전(개인 계정은 비공개 테스트 조건을 채우고 신청)

- 2026-11-12 재테크하는 직장인 판(맹고-문서/타겟.md): 제목 `맹고 - 경제 뉴스 읽어주는 앱, AI 뉴스 요약`, 부제 `금리·환율·주식, 내게 미칠 영향까지`, 키워드·설명·홍보 문구, 이미지 6장(`~/Desktop/maengo-store/2026-11-12`, raw4.mjs → compose.mjs). **Play** 등록정보·이미지·그래픽 커밋(검토). **iOS** 1.3.5(빌드 12)는 `asc-cancel.mjs`로 심사에서 빼고 `upload.mjs … asc`(부제 '내 관심 분야 소식, 오늘 뉴스 핵심 요약'·설명·키워드·홍보 문구·새 기능·이미지 6장)로 바꾼 뒤 `asc-submit.mjs 1.3.5 12`로 다시 냄(11-12 저녁, WAITING_FOR_REVIEW). 최종 문구는 같은 날 세 번 고친 판(타겟.md)

## Play 맞춤 등록정보: 해외 30개국(2026-11-06)

참조 이름 `해외 30개국 - 한국 관심(영어)`. 대상은 프로덕션 31개국에서 대한민국을 뺀 30개국, 공개 100%, 종료일 없음. 기본 언어는 앱 기본값(ko-KR)으로 고정이라 한국어 칸엔 교민용 문구, 영어 6종(en-US·GB·AU·CA·IN·SG)엔 아래 영어 문구. 그래픽은 기본 언어 하나(영어 캡션판, `node scripts/store/compose.mjs <raw> <out> <icon> --en`, `~/Desktop/maengo-store/2026-11-06-en/`)를 모든 언어가 같이 쓴다. 앱 화면은 한국어라 영어 설명에 그 사실을 밝힌다. 가격은 나라마다 환산가라 금액을 적지 않는다.

### 한국어(기본, 교민용)

앱 이름: 맹고

짧은 설명: 해외에서도 한국 소식과 관심 분야 소식을 AI가 한국어로 요약하고 읽어 드려요.

전체 설명: 위 전체 설명에서 첫 줄을 "해외에 살아도 한국 소식과 내 관심 분야 소식을 한국어로 챙기고 싶다면, 맹고."로, "만원 지하철에서도"를 "이동 중에도"로, Premium 가격을 "월 구독"으로, 구독 관리를 "Google Play의 구독 관리"로 바꾼 것.

### 영어(en-US·en-GB·en-AU·en-CA·en-IN·en-SG)

App name: Maengo: Korean News Audio

Short description: News on topics you pick, summarized and read aloud in natural Korean every day.

Full description:

```
Maengo picks the news on topics you care about, summarizes it in Korean, and reads it aloud. It's an easy way to keep up with Korea and to hear real, everyday Korean every day.

Please note: Maengo's screens, summaries, and audio are all in Korean.

[Who it's for]
• Korean learners (intermediate and up) who want daily reading and listening practice with real news
• Fans of Korea who want to follow what's happening there
• Koreans living abroad who want news from home in a few minutes

[What you get]
• Only your topics: AI, stocks, crypto, chips and robots, tech, plus Korean headlines in politics, economy, society, life and culture, IT and science, and world. Add detailed topics like LLMs, US stocks, Bitcoin, or security
• Short summaries in Korean: the key points first, with a link to the original source on every story
• Global news in Korean: stories from global media and official blogs are summarized in Korean too, so you can read about things you already know in Korean
• No repeats: one story per event, the most talked-about first
• Listen: hear stories read aloud by an AI voice, even with the screen off, while the sentence being read is shown on screen
• Ask Maengo AI: curious about a story? Ask by text or voice and get answers based on that story
• Your links: add blogs and newsletters you follow, and new posts arrive as stories (Premium)
• Library: find past stories and play them again
• Notifications: get a heads-up when today's stories are ready at the time you choose

[Free and Premium]
• Free: 5 stories a day, 3 listens a day, 3 questions to Maengo AI a day, 1 month of past stories
• Premium (monthly subscription, 7-day free trial for first-time subscribers): 10 stories a day, unlimited listening with a more natural AI voice and playlists, 20 questions to Maengo AI a day, up to 20 topics including your own, 3 personal links, 6 months of past stories

Premium renews automatically every month. Cancel in Google Play subscriptions at least 24 hours before renewal to avoid the next charge. If you cancel during the free trial, you won't be charged.

Terms of use: https://watalabs.com/maengo/terms
Privacy policy: https://watalabs.com/maengo/privacy
```
