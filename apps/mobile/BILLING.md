# 맹고 인앱 결제(RevenueCat)

> 2026-10-13. 플랜·지갑 숫자는 `packages/core/src/plans.ts` 한 곳에서 정한다. 이 문서는 스토어·RevenueCat·Vercel에서 할 일.

## 구조

- 앱(Capacitor)이 `@revenuecat/purchases-capacitor`로 애플 인앱 결제·구글 플레이 결제를 띄운다(`apps/web/lib/native/billing.ts`, 화면은 설정 > 플랜 `PlanStore`).
- RevenueCat의 app_user_id = Supabase 회원 id.
- 결제·복원을 마치면 앱이 `POST /api/billing/sync`를 부르고, RevenueCat은 웹훅 `POST /api/billing/revenuecat`을 보낸다. 둘 다 내용을 믿지 않고 RevenueCat REST(`GET /v1/subscribers/{id}`)를 다시 읽어 맞춘다(`apps/web/lib/server/billing.ts`).
  - Premium 권한(`premium`)이 살아 있으면 `profiles.plan = plus`, `premium_until = 만료(유예 포함)`, 끝났으면 Free로 내림
  - 맹고 묶음(소모성)은 거래마다 한 번 지갑에 넣음(`wallet_credit`, ref `rc:거래ID`)
- 웹 브라우저에서는 결제가 없다("맹고 앱에서 살 수 있어요").

## 상품(세 곳에 같은 ID)

| ID | 종류 | 맹고 | 가격 |
|---|---|---|---|
| `maengo_premium_monthly` | 자동 갱신 구독 1개월(플레이는 기본 요금제 `monthly`), **첫 구독 7일 무료** | 하루 맹고 10(plans 표) | ₩5,900 |
| `maengo_pack_10` | 소모성 | 10 | ₩1,100(맹고당 110원) |
| `maengo_pack_30` | 소모성 | 30 | ₩2,900(97원) |
| `maengo_pack_50` | 소모성 | 50 | ₩4,400(88원) |
| `maengo_pack_100` | 소모성 | 100 | ₩7,900(79원) |

묶음 가격(결정 D1, 2026-10-14): 많이 살수록 조금 싸게, 100맹고는 Premium 한 달(₩5,900)보다 싸지 않게. 애플에 같은 가격이 없으면 가장 가까운 가격으로 하고 이 표를 고친다. 화면은 스토어가 준 가격을 그대로 보여 준다.

무료 체험(결정 D3): 스토어가 처리한다(첫 구독만, 스토어 계정마다 한 번). 앱은 상품에 0원 첫 기간이 있고 받을 수 있는 사람이면 버튼을 "7일 무료로 시작"으로 바꾸고 체험 뒤 결제 금액을 적는다(`lib/native/billing.ts` `trialDays`). iOS는 RevenueCat에 받을 수 있는지 따로 묻는다. 약관 6조에 체험 조항이 있다.

맹고 추가 구매는 Premium만(화면에서 막는다). 스토어 결제에 수량 지정이 없어서 수량마다 상품을 하나씩 둔다. 수량을 바꾸려면 `packages/core/src/plans.ts`의 `MAENGO_PACKS`와 세 곳의 상품을 같이 바꾼다.

## 할 일

### 1. App Store Connect
1. 계약·세금·금융: 유료 앱 계약(Paid Apps)에 서명, 은행·세금 정보. 스몰 비즈니스 프로그램(수수료 15%) 신청
2. 앱 만들기(번들 `kr.maengo.app`, STORE.md의 iOS 순서. Xcode에 애플 계정 로그인이 먼저)
3. 구독 그룹 `맹고 Premium` → 자동 갱신 구독 `maengo_premium_monthly`(1개월, ₩5,900, 한국어 표시 이름·설명, 심사용 스크린숏) → 구독 가격 → **유입 혜택(Introductory Offer)**: 무료, 1주, 모든 국가
4. 앱 내 구입 → 소모성 `maengo_pack_10`·`30`·`50`·`100`
5. 사용자 및 액세스 → 통합 → **앱 내 구입 키**(.p8) 만들기 → RevenueCat에 올림
6. 앱 정보 → App Store 서버 알림 V2 URL에 RevenueCat이 알려 주는 주소
7. 사용자 및 액세스 → 샌드박스 테스터 계정

### 2. Play Console
1. 결제 프로필(판매자 계정) 만들기
2. **BILLING 권한이 든 새 AAB**를 비공개 테스트에 올린다(예전 `maengo-1.0.0-1.aab`에는 없음 → 버전 코드 올려 다시 빌드). 올려야 상품을 만들 수 있다
3. 수익 창출 → 구독 `maengo_premium_monthly`, 기본 요금제 `monthly`(매월 자동 갱신, ₩5,900) → **혜택 추가**: 무료 체험 7일, 자격은 '신규 고객'(이 구독을 산 적 없는 사람)
4. 인앱 상품 `maengo_pack_10`·`30`·`50`·`100`
5. Google Cloud 서비스 계정(Play Developer API) JSON → Play Console 사용자 권한(재무 데이터 보기·주문 관리) → RevenueCat에 올림
6. 실시간 개발자 알림(Pub/Sub)은 RevenueCat 안내대로 연결
7. 라이선스 테스터에 테스트 계정

### 3. RevenueCat
1. 프로젝트 `맹고` → 앱 2개(App Store `kr.maengo.app`, Play Store `kr.maengo.app`)에 1·2의 키 연결
2. 상품 가져오기 → **Entitlement `premium`**에 두 스토어의 `maengo_premium_monthly`를 붙인다(묶음은 붙이지 않음)
3. **Offering `default`(Current)**: 패키지 `$rc_monthly` → 구독, 사용자 지정 패키지 `pack_10`·`pack_30`·`pack_50`·`pack_100` → 맹고 추가 구매(두 스토어 상품 모두)
4. API 키: 공개 키 `appl_…`·`goog_…`, 비밀 키(v1) `sk_…`
5. 통합 → 웹훅: URL `https://maengo.vercel.app/api/billing/revenuecat`(도메인을 사면 그 주소), Authorization `Bearer {REVENUECAT_WEBHOOK_AUTH}`(아무 긴 무작위 값)

### 4. Vercel(운영)·`.env.local`
```
NEXT_PUBLIC_REVENUECAT_IOS_KEY=appl_…
NEXT_PUBLIC_REVENUECAT_ANDROID_KEY=goog_…
REVENUECAT_SECRET_KEY=sk_…
REVENUECAT_WEBHOOK_AUTH=…
```
`NEXT_PUBLIC_`은 빌드 때 들어가니 넣은 뒤 다시 배포한다. 앱은 웹을 띄우므로 앱 다시 빌드는 필요 없다(플러그인 네이티브 쪽은 이번 앱 빌드에 들어 있어야 함).

### 5. 확인
- 샌드박스로 Premium 구매 → 설정 > 플랜이 Premium, 하루 맹고 10개 → 구독 관리에서 해지 → 만료 뒤 Free
- 맹고 추가 구매(Premium) → 수량 고르고 결제 → 지갑 +수량, 같은 거래가 웹훅·sync로 두 번 와도 한 번만
- 앱 지우고 다시 깔아 구매 복원 → Premium 그대로

## 베타 종료(2026-10-14, 코드 반영)
- `BETA` 상수와 Beta 배지를 없앴다. Premium 하루 10개, 설정에 결제가 늘 보인다(앱에서만)
- 마이그레이션 `20261014100000_end_beta.sql`: 가입하면 Free, 베타 Premium(`premium_until` 없음)은 Free로
- 약관 6조(앱 안 결제·자동 갱신·해지·청약철회), 처리방침(결제 기록 항목, RevenueCat 위탁·국외 이전), 시행일 2026-10-14
- 남은 것: 스토어 개인정보(애플 '구입 항목', 플레이 데이터 보안 '구매 내역')는 앱을 다시 낼 때
