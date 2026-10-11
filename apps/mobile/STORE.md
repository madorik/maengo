# 맹고 스토어 등록(비공개 테스트까지)

> 2026-10-11. 콘솔에 그대로 붙여 넣을 문구와 답, 순서. 그래픽·스크린샷·AAB는 저장소 밖 `~/Desktop/maengo-store/`, `~/Desktop/maengo-1.0.0-1.aab`에 있다(다시 만드는 법은 맨 아래).

## 공통 정보

| 항목 | 값 |
| --- | --- |
| 앱 이름 | 맹고 (이미 쓰는 이름이면 `맹고 - 맞춤 뉴스 요약`) |
| 패키지·번들 ID | `kr.maengo.app` |
| 카테고리 | 뉴스 및 잡지(Play) / 뉴스(App Store) |
| 연락처 이메일 | wandeung.help@gmail.com |
| 웹사이트 | https://maengo.vercel.app |
| 개인정보 처리방침 | https://maengo.vercel.app/privacy |
| 이용약관 | https://maengo.vercel.app/terms |
| 계정 삭제 안내(Play) | https://maengo.vercel.app/delete-account |
| 가격 | 무료(앱 안 결제 없음) |

### 짧은 설명(Play, 80자 이내)
관심 분야 소식만 골라 AI가 요약하고 읽어 드려요. 출퇴근길에 듣는 맞춤 뉴스.

### 전체 설명(Play 전체 설명 / App Store 설명)
쏟아지는 소식 속에서 내가 관심 있는 것만 챙기고 싶다면, 맹고.

맹고는 고른 관심 분야(AI, 주식, 코인, 반도체·로봇, 개발, K-Pop, K-뷰티, K-푸드)의 국내외 매체·공식 블로그 소식을 매일 모아, 꼭 볼 만한 것만 골라 짧게 요약해 드려요. 요약마다 원문 출처를 함께 붙여서 더 궁금하면 바로 확인할 수 있어요.

• 오늘의 맹고: 정한 시간에 오늘 고른 소식이 준비돼요
• 듣기: 글로 읽기 힘들 때는 아나운서 목소리로 들어요. 출퇴근길·운동할 때 끝까지 이어서 들려 드려요
• 대본 보기: 듣는 동안 지금 읽는 문장을 함께 보여 줘요
• 보관함: 지난 소식을 모아 두고, 골라서 이어 듣기도 할 수 있어요
• 관심사: 분야 전체를 고르거나 세부 주제를 더하고, 목록에 없으면 직접 적어요

지금은 베타 기간이라 모든 기능을 무료로 쓸 수 있어요.

### 출시 노트(첫 버전)
맹고 첫 비공개 테스트 버전이에요. Google·Apple 계정으로 바로 시작할 수 있어요.

## Android — Google Play 비공개 테스트

1. **앱 만들기**: Play Console > 앱 만들기. 앱 이름 `맹고`, 기본 언어 `한국어 – ko-KR`, 앱, 무료, 선언 두 개 체크
2. **앱 콘텐츠**(대시보드 > 앱 설정): 아래 '앱 콘텐츠 답' 대로
3. **기본 스토어 등록정보**: 위 짧은 설명·전체 설명, 앱 아이콘 `icon-512.png`, 그래픽 이미지 `feature-1024x500.png`, 휴대전화 스크린샷 `phone-1~5.png`(1080×1920). 카테고리 뉴스 및 잡지, 연락처 이메일·웹사이트
4. **테스터 그룹**(누구나 링크로 참여): https://groups.google.com 에서 그룹 만들기 → 이름 `맹고 테스터`, 이메일 예 `maengo-testers@googlegroups.com`, 공개 범위 '웹의 모든 사용자', 참여 '누구나 그룹에 참여 가능'
5. **비공개 테스트 트랙**: 테스트 및 출시 > 테스트 > 비공개 테스트 > (기본 트랙 'Closed testing - Alpha') > 테스터 탭 > Google 그룹에 위 그룹 이메일 추가 > 피드백 이메일 wandeung.help@gmail.com > 저장
6. **버전 만들기**: 같은 트랙 > 새 버전 만들기 > Play 앱 서명은 '계속'(Google이 앱 서명 키를 관리, 우리는 업로드 키로 서명) > `maengo-1.0.0-1.aab` 업로드 > 출시 노트 > 검토 > 출시 시작
7. 구글 검토가 끝나면(몇 시간~며칠) 테스터 탭의 **'웹에서 참여' 링크**가 열린다. 테스터는 ① 그룹 가입 ② 참여 링크에서 '테스터 되기' ③ Play 스토어에서 설치
8. 프로덕션 출시 조건(개인 계정): 테스터 12명 이상이 14일 연속 참여

### 앱 콘텐츠 답

| 항목 | 답 |
| --- | --- |
| 개인정보처리방침 | https://maengo.vercel.app/privacy |
| 앱 액세스 권한 | '모든 기능 또는 일부 기능이 제한됨' → 안내: "Google 계정 또는 Apple 계정으로 로그인하면 바로 가입됩니다(어떤 Google 계정도 가능, 따로 드릴 아이디·비밀번호 없음). 처음 들어오면 관심 분야를 고르고 '오늘 맹고 받기'를 누르면 소식이 나옵니다." |
| 광고 | 광고 없음 |
| 콘텐츠 등급 | 이메일 wandeung.help@gmail.com, 카테고리 '참고 자료, 뉴스 또는 교육'. 폭력·성적 콘텐츠·욕설·약물·도박 모두 아니요. 사용자 간 소통·콘텐츠 공유 아니요, 위치 공유 아니요, 디지털 구매 아니요 |
| 타겟층 | 13~15세, 16~17세, 18세 이상(약관상 만 14세 이상). 아동에게 어필하지 않음 |
| 뉴스 앱 | 예. 발행자 = 운영자 정민균, 연락처 wandeung.help@gmail.com, 웹사이트 https://maengo.vercel.app. 소식마다 원문 출처를 표시함 |
| 정부·금융·건강 앱 | 모두 아니요 |
| 데이터 보안 | 아래 |

### 데이터 보안 답
- 수집: 예 / 공유(제3자 제공): 아니요 / 전송 중 암호화: 예 / 삭제 요청 방법: 앱 안 설정 > 계정 삭제, https://maengo.vercel.app/delete-account
- 수집하는 데이터(모두 '필수', 목적 '앱 기능' + '계정 관리', 처리 방식 '수집')
  - 개인 정보: 이름, 이메일 주소, 사용자 ID
  - 앱 활동: 앱 상호작용(읽음·들음·좋아요/싫어요), 기타 사용자 생성 콘텐츠(관심사 '기타'에 적은 말)
- 수집하지 않음: 위치, 금융, 건강, 연락처, 사진·동영상, 오디오, 파일, 캘린더, 메시지, 웹 기록, 기기 ID
- 앱 알림(FCM)을 앱에 붙이면 '기기 또는 기타 ID'를 더한다

## iOS — TestFlight 공개 링크

1. **Xcode에 Apple 계정 로그인**: Xcode > Settings > Accounts > + > Apple ID(개발자 계정). 이게 있어야 서명·업로드를 명령줄로 할 수 있다
2. (Claude) 아카이브 → 이때 App ID `kr.maengo.app`이 자동 등록된다
3. **App Store Connect 앱 만들기**: 앱 > + > 신규 앱. 플랫폼 iOS, 이름 `맹고`, 기본 언어 한국어, 번들 ID `kr.maengo.app`, SKU `maengo-ios`, 사용자 액세스 전체
4. (Claude) 빌드 업로드 → 처리 10~30분
5. **TestFlight > 테스트 정보**: 베타 앱 설명(위 짧은 설명), 피드백 이메일 wandeung.help@gmail.com, 마케팅 URL https://maengo.vercel.app, 개인정보 처리방침 URL
6. **베타 앱 검토 정보**: 연락처(이름·전화·이메일), '로그인 필요' 체크 해제, 메모: "Sign in with Apple 또는 Google로 바로 가입할 수 있습니다(별도 데모 계정 없음). 첫 화면에서 관심 분야를 고르고 '오늘 맹고 받기'를 누르면 소식이 나옵니다. 듣기 버튼으로 요약을 음성으로 들을 수 있습니다."
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
- iOS: `cd ios/App && xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath <경로>.xcarchive -allowProvisioningUpdates archive` → `xcodebuild -exportArchive`(ExportOptions: method app-store-connect, destination upload, teamID QYS79FM739)
- 그래픽: 아이콘은 `assets/icon-only.png`를 512로 줄인 것. 그래픽 이미지·스크린샷은 로컬 개발 서버의 데모 계정 화면을 앱 UA로 찍었다(1080×1920)
