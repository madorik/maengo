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
| `maengo_premium_monthly` | 자동 갱신 구독 1개월(플레이는 기본 요금제 `monthly`), **첫 구독 7일 무료** | 하루 맹고 10(plans 표) | **₩3,800**(화면엔 정가 ₩5,900 취소선 + 35% 할인) |
| `maengo_pack_10` | 소모성 | 10 | ₩1,100(맹고당 110원) |
| `maengo_pack_30` | 소모성 | 30 | ₩2,900(97원) |
| `maengo_pack_50` | 소모성 | 50 | ₩4,400(88원) |
| `maengo_pack_100` | 소모성 | 100 | ₩7,900(79원) |

구독 가격(2026-10-15 사용자 결정): 정가 ₩5,900을 취소선으로 보여 주고 ₩3,800으로 결제한다(할인율은 화면에서 내림 계산, plans 표 `price_krw`·`list_price_krw`). 스토어 상품 가격은 ₩3,800(애플 순수익 ₩2,936)로 만들고, 가격을 바꾸면 plans 표도 같이 바꾼다.

묶음 가격(결정 D1, 2026-10-14): 많이 살수록 조금 싸게, 100맹고는 Premium 한 달보다 싸지 않게. 애플에 같은 가격이 없으면 가장 가까운 가격으로 하고 이 표를 고친다. 화면은 스토어가 준 가격을 그대로 보여 준다.

무료 체험(결정 D3, 2026-10-18 바꿈): **우리 회원의 첫 구독만 7일 무료**, 끝나면 스토어가 자동 결제·매달 갱신. 결제 창을 띄우기 전에 앱 안 팝업(`components/premium/TrialConsent.tsx`)으로 '무료 체험은 최초 1회만'(맨 위)·체험 기간·첫 결제일·금액·해지 방법을 보여 주고, '위 내용을 확인했습니다.' 체크박스에 체크해야 '7일 무료로 시작'이 눌린다. 동의 기록은 남기지 않는다(10-18 사용자 결정, 처음엔 체크할 때 `trial_consents`에 남겼다가 뺌. 표는 남아 있지만 쓰지 않음). 전에 구독한 적 있으면(`subscriptions`·`purchases` 기록) 체험 없이 바로 결제: 안드로이드는 체험 없는 기본 요금제로 결제하고, iOS는 애플이 체험을 계정당 한 번만 준다. 체험 중에는 Premium을 주고 `subscriptions.status = 'trial'`, 설정 > 플랜과 /premium에 '무료 체험 중 · M월 D일부터 월 3,800원 결제'. Test Store 상품에는 체험을 붙일 수 없어(API에 칸 없음) 실제 체험 결제는 스토어 샌드박스에서 확인한다. 스토어도 체험은 첫 구독만(스토어 계정마다 한 번). 앱은 상품에 0원 첫 기간이 있고 받을 수 있는 사람이면 버튼을 "7일 무료로 시작"으로 바꾸고 체험 뒤 결제 금액을 적는다(`lib/native/billing.ts` `trialDays`). iOS는 RevenueCat에 받을 수 있는지 따로 묻는다. 약관 6조에 체험 조항이 있다.

맹고 추가 구매는 Free·Premium 모두(2026-10-15 사용자 결정, plans 표 `can_buy_maengo`). 스토어 결제에 수량 지정이 없어서 수량마다 상품을 하나씩 둔다. 수량을 바꾸려면 `packages/core/src/plans.ts`의 `MAENGO_PACKS`와 세 곳의 상품을 같이 바꾼다.

## 할 일

### 1. App Store Connect
1. 계약·세금·금융: 유료 앱 계약(Paid Apps)에 서명, 은행·세금 정보. 스몰 비즈니스 프로그램(수수료 15%) 신청
2. 앱 만들기(번들 `kr.maengo.app`, STORE.md의 iOS 순서. Xcode에 애플 계정 로그인이 먼저)
3. 구독 그룹 `맹고 Premium` → 자동 갱신 구독 `maengo_premium_monthly`(1개월, ₩3,800, 한국어 표시 이름·설명, 심사용 스크린숏) → 구독 가격 → **유입 혜택(Introductory Offer)**: 무료, 1주, 모든 국가
4. 앱 내 구입 → 소모성 `maengo_pack_10`·`30`·`50`·`100`
5. 사용자 및 액세스 → 통합 → **앱 내 구입 키**(.p8) 만들기 → RevenueCat에 올림
6. 앱 정보 → App Store 서버 알림 V2 URL에 RevenueCat이 알려 주는 주소
7. 사용자 및 액세스 → 샌드박스 테스터 계정

### 2. Play Console
1. 결제 프로필(판매자 계정) 만들기
2. **BILLING 권한이 든 새 AAB**를 비공개 테스트에 올린다(예전 `maengo-1.0.0-1.aab`에는 없음 → 버전 코드 올려 다시 빌드). 올려야 상품을 만들 수 있다
3. 수익 창출 → 구독 `maengo_premium_monthly`, 기본 요금제 `monthly`(매월 자동 갱신, ₩3,800) → **혜택 추가**: 무료 체험 7일, 자격은 '신규 고객'(이 구독을 산 적 없는 사람)
4. 인앱 상품 `maengo_pack_10`·`30`·`50`·`100`
5. Google Cloud 서비스 계정(Play Developer API) JSON → Play Console 사용자 권한(재무 데이터 보기·주문 관리) → RevenueCat에 올림
6. 실시간 개발자 알림(Pub/Sub)은 RevenueCat 안내대로 연결
7. 라이선스 테스터에 테스트 계정

### 3. RevenueCat
1. 프로젝트 `맹고` → 앱 2개(App Store `kr.maengo.app`, Play Store `kr.maengo.app`)에 1·2의 키 연결
2. 상품 가져오기 → **Entitlement `premium`**에 두 스토어의 `maengo_premium_monthly`를 붙인다(묶음은 붙이지 않음)
3. **Offering `default`(Current)**: 패키지 `$rc_monthly` → 구독, 사용자 지정 패키지 `pack_10`·`pack_30`·`pack_50`·`pack_100` → 맹고 추가 구매(두 스토어 상품 모두)
4. API 키: 공개 키 `appl_…`·`goog_…`, 비밀 키(v1) `sk_…`
5. 통합 → 웹훅: URL `https://watalabs.com/maengo/api/billing/revenuecat`(예전 `https://maengo.vercel.app/api/billing/revenuecat`도 그대로 받는다), Authorization `Bearer {REVENUECAT_WEBHOOK_AUTH}`(아무 긴 무작위 값)

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
- 맹고 추가 구매(Free·Premium) → 수량 고르고 결제 → 지갑 +수량, 같은 거래가 웹훅·sync로 두 번 와도 한 번만
- 앱 지우고 다시 깔아 구매 복원 → Premium 그대로

## 이력(2026-10-18)

결제(`purchases`)·웹훅 원본(`billing_events`)·플랜 변경(`plan_changes`)·맹고 지갑(`wallet_ledger`)을 DB에 남긴다. 무엇이 언제 쌓이는지와 문의 대응 SQL은 `맹고-문서/결제-이력-기록.md`. 플랜은 앱 코드가 직접 고치지 않고 `set_plan(회원, 플랜, 만료, 이유)`로 바꾼다(트리거가 이유와 함께 남긴다).

## Test Store로 먼저 시험(로컬, 2026-10-18)

애플·구글 계약 없이 RevenueCat 안의 가짜 스토어로 결제 흐름(구독 → Premium, 묶음 → 지갑, 복원)을 본다. 실제 결제창·가격·무료 체험 자격·웹훅은 못 본다(RevenueCat이 로컬 서버에 닿지 않음. 앱이 결제 직후 `/api/billing/sync`를 부르니 상태는 맞춰진다).

1. **사용자**: RevenueCat 가입 → 프로젝트 `맹고` → Apps & providers → Test configuration에서 Test Store 만들기 → 키 `test_…`
2. **사용자**: Project settings → API keys → 비밀 키 두 개: v1(`sk_…`, 서버가 구독 상태를 읽음), v2(`sk_…`, 권한 Project configuration 읽기·쓰기, 아래 스크립트용). 프로젝트 ID(`proj…`)는 주소창이나 Project settings
3. `apps/web/.env.local`에만 넣는다(운영 Vercel에는 **절대** `test_` 키를 넣지 않는다. 릴리스 앱이 이 키를 받으면 SDK가 일부러 멈춘다. `lib/native/billing.ts`도 운영 빌드에서는 `test_` 키를 무시한다)
   ```
   NEXT_PUBLIC_REVENUECAT_IOS_KEY=test_…
   NEXT_PUBLIC_REVENUECAT_ANDROID_KEY=test_…
   REVENUECAT_SECRET_KEY=sk_…(v1)
   REVENUECAT_API_V2_KEY=sk_…(v2)
   REVENUECAT_PROJECT_ID=proj…
   ```
4. **나**: `pnpm revenuecat:setup`(상품 5개·권한 `premium`·오퍼링 `default` Current. 테스트 상품은 API로 가격을 못 넣어 RevenueCat 기본값으로 보인다) → 로컬 서버 다시 띄우기(`NEXT_PUBLIC_`은 서버를 켤 때 들어감) → 디버그 앱(`CAP_SERVER_URL=http://localhost:3100/maengo`)에서 아래 5. 확인
5. 무료 체험 흐름(동의 팝업)을 Test Store로 보려면 `.env.local`에 `NEXT_PUBLIC_TEST_TRIAL_DAYS=7`. Test Store 상품엔 체험을 붙일 수 없어서 test_ 키일 때만 체험이 있는 것처럼 보인다(결제는 체험 없이 되고 상태도 trial이 아님). 데모 계정을 '처음 구독' 상태로 되돌리려면 그 회원의 `subscriptions`·`purchases`(kind subscription)·`trial_consents`를 지우고 `set_plan(…, 'free', null, 'demo_reset')`, RevenueCat은 `DELETE /v1/subscribers/{id}`
6. 실제 스토어를 붙일 때도 같은 스크립트를 `pnpm revenuecat:setup app_store`·`play_store`로 돌릴 수 있다(스토어에 상품을 먼저 만든 뒤)

### 시험 결과(2026-10-18, 데모 계정)
- 안드로이드 에뮬레이터·iOS 시뮬레이터 모두 Test Store 결제 창(정상·실패·취소)이 뜨고 원화 가격(₩3,800, 묶음 ₩1,100~₩7,900)으로 보임
- 구독 정상 → Premium(만료 5분 뒤), 묶음 10 정상 → 지갑 +10(안드로이드·iOS 각각, 거래마다 한 줄), 같은 거래로 `/api/billing/sync`를 두 번 더 불러도 추가 지급 0
- 실패 → "결제하지 못했어요. 다시 시도해 주세요.", 취소 → 아무 문구·변화 없음(구독·묶음, 두 플랫폼). 처음 한 번 안드로이드 구독 창에서 취소를 눌렀는데 결제가 된 적이 있으나 다시는 재현되지 않음(터치가 다른 버튼에 걸린 것으로 봄)
- 구매 복원 → RevenueCat 복원 + 서버 동기화
- Test Store 구독은 5분짜리이고 자동 갱신된다. 로컬엔 웹훅이 안 와서 만료 시각이 지나면 Free로 내려갔다 → 내리기 직전에 RevenueCat을 다시 읽도록 고침(`lib/server/profile.ts` renewedUntil). 운영에서도 갱신 웹훅이 늦을 때 Premium이 끊겨 보이지 않는다
- 알게 된 것: 새 프로젝트에는 예시(상품 monthly·yearly·lifetime, 권한 `maengo_pro`, 오퍼링 `default`의 `$rc_monthly`에 monthly)가 있다. 스크립트가 `$rc_monthly`에서 예시를 떼고 우리 상품을 붙인다. 예시 자체는 앱이 무시하니 그대로 둠. Test Store 상품은 가격이 없으면 SDK가 "Could not find ProductDetails"로 못 찾고, 가격은 만들기 API에 칸이 없어 `test_store_prices`로 넣는다. 고객 지우기(`DELETE /v1/subscribers`)를 해도 Test Store 구독은 다시 붙는다
- 못 본 것: 실제 애플·구글 결제창, 7일 무료 체험(Test Store 상품엔 체험 없음), 웹훅, 해지 → 만료

## 결제 시나리오(2026-10-18 Test Store로 모두 통과, 안드로이드 에뮬레이터 + iOS 시뮬레이터 일부)

실제 스토어 샌드박스로 넘어가면 같은 순서로 다시 확인한다. Test Store 결과에서 다른 점은 ⚠︎로 적었다.

| # | 시나리오 | 기대 결과 | Test Store 결과 |
|---|---|---|---|
| S1 | 처음 구독(체험) | 버튼 '7일 무료로 시작' → 안내 맨 위 '최초 1회만' → 체크 전 시작 막힘 → 체크하면 시작 눌림(서버 요청 없음) → 결제 → '7일 무료 체험을 시작했어요(10월 25일 결제)' 팝업 → Premium, `plan_changes` free→plus `app_sync`, `purchases` 한 줄 | 통과 ⚠︎ Test Store엔 체험이 없어 `NEXT_PUBLIC_TEST_TRIAL_DAYS`로 흉내, 상태는 trial이 아닌 active |
| S2 | 결제 뒤 화면 | 결제 화면 'Premium을 쓰고 있어요', 계정 메뉴·설정 Premium | 통과 |
| S3 | 구독한 적 있는 회원 | 체험 버튼·안내 팝업이 안 나옴(서버가 구독 기록으로 판단, S4) | 통과(동의 API는 10-18에 뺌) |
| S4 | 해지 뒤 다시 구독 | 'Premium 시작 · 월 ₩3,800', 안내 팝업 없이 바로 결제 | 통과 ⚠︎ 안드로이드 실제 Play에서는 체험 없는 기본 요금제로 결제되는지 확인 |
| S5 | 맹고 묶음 결제 실패 | '결제하지 못했어요' 문구, 지갑·동기화 그대로 | 통과 |
| S6 | 맹고 묶음 결제 창 취소 | 문구·팝업 없음, 지갑 그대로 | 통과 |
| S7 | 맹고 10개 구매 | '맹고 10개를 지갑에 넣었어요~' 팝업, 지갑 +10, `purchases.rc_id` = `wallet_ledger.ref`의 rc: 뒤 | 통과 |
| S8 | 같은 거래 다시 동기화 | 추가 지급 0 | 통과 |
| S9 | 구매 복원 | 오류 없음, 서버 동기화 | 통과 |
| S10 | 기한은 지났지만 스토어에서 갱신됨 | Premium 유지(`renewal_check`) | 통과 |
| S11 | 스토어에서도 끝남 | Free(`expiry`), 계정 메뉴도 Free | 통과 |
| S12 | 체험 중 표시 | 설정·결제 화면 '무료 체험 중 · 10월 25일부터 월 3,800원 결제', 체험 중 해지면 '10월 25일에 끝나요' | 통과(상태를 DB에서 trial로 두고 확인) ⚠︎ 실제 trial 상태는 샌드박스에서 |
| S13 | 웹 브라우저 | 결제 화면은 '결제는 맹고 앱에서만' 안내, 주 메뉴에 '요금', 소개 페이지 요금 영역엔 안내 없음 | 통과 |
| S14 | 결제를 켰는데 웹훅 비밀값이 없음 | 401 + 관리자 빨간 줄(결제를 켜기 전엔 알리지 않음) | 통과 |
| (앞서) | 가짜 웹훅 RENEWAL 두 번 | `billing_events`·`purchases` 한 줄씩 | 통과(10-18 오전) |

샌드박스에서만 볼 수 있는 것: 실제 7일 체험(`period_type` trial → `subscriptions.status` trial), 체험 끝 자동 결제(`is_trial_conversion`) → active, 체험 중 해지 → 끝나는 날 Free, 실제 결제창·원화 가격, 웹훅 전체.

## 베타 종료(2026-10-14, 코드 반영)
- `BETA` 상수와 Beta 배지를 없앴다. Premium 하루 10개, 설정에 결제가 늘 보인다(앱에서만)
- 마이그레이션 `20261014100000_end_beta.sql`: 가입하면 Free, 베타 Premium(`premium_until` 없음)은 Free로
- 약관 6조(앱 안 결제·자동 갱신·해지·청약철회), 처리방침(결제 기록 항목, RevenueCat 위탁·국외 이전), 시행일 2026-10-14
- 남은 것: 스토어 개인정보(애플 '구입 항목', 플레이 데이터 보안 '구매 내역')는 앱을 다시 낼 때
