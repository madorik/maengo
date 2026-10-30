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
