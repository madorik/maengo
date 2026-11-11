# 맹고 사용 패턴 분석(GTM + GA4)

> 2026-10-11. 코드는 끝났고(이벤트가 `window.dataLayer`에 쌓인다), GTM 컨테이너 ID를 넣으면 GA4로 가기 시작한다.
> 2026-10-17 연결: GA4 측정 ID `G-5FYPYJMVQ1`(웹 스트림 https://watalabs.com), GTM 컨테이너 `GTM-MQ7KSJJK`(Vercel `NEXT_PUBLIC_GTM_ID`). `gtm-import.json`에 측정 ID를 넣어 둠(가져온 뒤 변수를 안 고쳐도 됨).
> 코드: `lib/analytics.ts`(track), `components/Analytics.tsx`(GTM 싣기, 운영 + `NEXT_PUBLIC_GTM_ID`일 때만), `components/AnalyticsSession.tsx`(사용자 ID·플랜·플랫폼).
> 2026-11-07: GTM 버전 3 게시(둘러보기 try_* 이벤트·값 items·heard·where·signed_in, 이 파일 병합 가져오기). GA4 맞춤 정의 16개 등록(이벤트 14: mode·category·kind·action·reason·topic·voice·provider·product·charged·items·heard·where·signed_in, 사용자 2: plan·platform). GA4 속성은 계정 '정민균'(352006364)의 '맹고(Maengo)'(559406417), GTM은 계정 '와타랩스'(6383117467) 컨테이너 267447389. 같은 GA 계정에 다른 속성(또닥 AI 등)이 있어 기본으로 그쪽이 열린다.
> 2026-11-07 밤: GTM 버전 4 '북마크 이벤트' 게시(트리거 '맹고 이벤트' 정규식에 `bookmark`, 값 `on`·`category`·`where`는 기존 변수·태그 매개변수). GA4 맞춤 정의 `on`(이벤트 범위, 켰는지: 북마크·알림 켜고 끄기) 등록 → 17개. 둘 다 전용 크롬 창(`~/.maengo/chrome-youtube`, 포트 9333)에 원격으로 붙어서 함.
> 2026-11-11: GTM 버전 5 '앱 받기·주간 리포트 이벤트' 게시(트리거 '맹고 이벤트' 정규식에 `app_install_click`·`report_open`·`report_make`. 리포트 이벤트는 11-10 코드에 넣고 GTM엔 빠져 있었다). 값 `where`·`kind`는 기존 태그 매개변수·맞춤 정의. 전용 크롬 창(포트 9333)으로 함.
> 개인정보: 이름·이메일·직접 적은 관심사는 보내지 않는다. 사용자 ID는 회원 id의 SHA-256 앞 24자리. 처리방침에 Google 애널리틱스를 넣었다(2026-10-11).

## 사용자가 할 일

1. **GA4 속성**: https://analytics.google.com → 관리 → 만들기 → 속성 `맹고`(시간대 대한민국, 통화 원) → 데이터 스트림 '웹' → `https://watalabs.com` → 측정 ID(`G-…`)
   - 관리 → 데이터 수집 및 수정 → 데이터 보관 → **14개월**(처리방침과 같게)
2. **GTM 컨테이너**: https://tagmanager.google.com → 계정 만들기 `맹고` → 컨테이너 `watalabs.com`, 대상 '웹' → 컨테이너 ID(`GTM-…`)를 Claude에게 알려 준다(Vercel 환경 변수 `NEXT_PUBLIC_GTM_ID`에 넣고 배포)
3. **GTM 안 설정**: 관리 → 컨테이너 가져오기 → [`gtm-import.json`](gtm-import.json)(작업공간 Default, 병합·충돌하면 덮어쓰기) → 변수 `GA4 측정 ID`의 값을 `G-…`로 바꾸기 → 제출 → 게시. 가져오기가 안 되면 아래 '태그 설정'대로 손으로 만든다
4. **GA4 맞춤 정의**(2026-11-07 완료): 관리 → 맞춤 정의 → 이벤트 범위 `mode`·`category`·`kind`·`action`·`reason`·`topic`·`voice`·`provider`·`product`·`charged`·`items`·`heard`·`where`·`signed_in`·`on`(북마크와 함께 추가), 사용자 범위 `plan`·`platform`

## 태그 설정(GTM, `gtm-import.json`에 든 것)

- **변수**: 상수 `GA4 측정 ID`(`G-…`), 데이터 영역 변수(버전 2) `user_id`, `plan`, `platform`, `provider`, `mode`, `count`, `category`, `kind`, `today`, `topics`, `reason`, `action`, `group`, `picks`, `topic`, `on`, `voice`, `charged`, `product`, `items`, `heard`, `where`, `signed_in` — 이름을 각각 `dlv - 이름`으로
- **Google 태그**: 태그 ID `{{GA4 측정 ID}}`, 트리거 'Initialization - All Pages'. 페이지 이동은 GA4 향상된 측정의 '브라우저 기록 이벤트 기반 페이지 변경'(기본 켜짐)이 잡는다
- **GA4 이벤트 태그 하나**: 측정 ID `{{GA4 측정 ID}}`, 이벤트 이름 `{{Event}}`
  - 이벤트 매개변수: `user_id`·`provider`·`mode`·`count`·`category`·`kind`·`today`·`topics`·`reason`·`action`·`group`·`picks`·`topic`·`on`·`voice`·`charged`·`product`·`items`·`heard`·`where`·`signed_in` ← 같은 이름의 변수(뒤의 넷은 둘러보기, 2026-11-07)
  - 사용자 속성: `plan` ← `{{dlv - plan}}`, `platform` ← `{{dlv - platform}}`
  - 트리거: 맞춤 이벤트, 이벤트 이름 정규식 일치
    `^(identify|login_start|onboarding_complete|today_build|item_open|source_open|listen_start|listen_complete|script_tab_open|feedback|topic_edit|link_edit|notify_toggle|push_open|widget_open|voice_change|more_receive|share|bookmark|ask|purchase_start|purchase_complete|try_start|try_complete|try_trial_click|try_ask|report_open|report_make|app_install_click)$`
- 이벤트를 새로 넣으면 `lib/analytics.ts`의 `AnalyticsEvent`, 이 문서, `gtm-import.json`의 정규식을 같이 고치고 GTM에 다시 게시한다

## 이벤트

| 이벤트 | 언제 | 값 |
| --- | --- | --- |
| `identify` | 로그인한 화면을 열 때 | `user_id`(해시), `plan`(plus·free), `platform`(web·ios·android) |
| `login_start` | 구글·애플 로그인 버튼 | `provider` |
| `onboarding_complete` | 온보딩 '시작하기' | `topics`(고른 개수) |
| `today_build` | '오늘 맹고 받기' | `reason`(first·waiting·exhausted) |
| `item_open` | 글 상세를 열 때. 둘러보기(/try)에서는 카드의 대본을 처음 펼칠 때(소식마다 한 번, 2026-11-10) | `category`, `kind`(article·video), `today`(오늘 피드인지), `where`(둘러보기면 `try`) |
| `source_open` | 원문 링크 | `category`, `kind`, `where`(둘러보기면 `try`, 2026-11-10) |
| `listen_start` | 듣기 시작 | `mode`(today·today_one·item·playlist), `count`(플레이리스트 개수) |
| `listen_complete` | 끝까지 들음 | `mode`(today·item·playlist) |
| `script_tab_open` | 듣기 창 '대본' 탭 | `mode` |
| `feedback` | 좋아요·싫어요 | `kind`(more·skip·clear) |
| `topic_edit` | 관심사 고치기 | `action`(group·add·remove·text), `group`, `picks`, `topic`(직접 적은 건 custom) |
| `link_edit` | 내 관심 링크 넣기·빼기(Premium) | `action`(add·remove·fail), `reason`(fail일 때: invalid·youtube·blocked·private·unreachable·nofeed·empty·adult·limit). 주소는 남기지 않는다 |
| `notify_toggle` | 알림 켜고 끄기(설정. 온보딩 '시작하기'에서 권한을 물은 결과는 `group`=onboarding) | `on`, `group` |
| `push_open` | 알림을 눌러 들어옴(`?from=push`) | — |
| `widget_open` | 홈 화면 위젯을 눌러 들어옴(`?from=widget`, 앱 1.3부터) | — |
| `voice_change` | 목소리 바꾸기(설정) | `voice`(f·m) |
| `more_receive` | 하나 더 받기로 소식을 받음 | `charged`(지갑 맹고를 썼는지) |
| `share` | 글 화면 '공유'(1.2 앱·웹) | `category`, `action`(shared: 공유 시트를 띄움, copied: 공유 시트가 없어 복사), `place`(header: 머리말 아이콘, body: 본문 '공유하기' 버튼, 2026-10-31부터) |
| `bookmark` | 북마크 켜고 끄기(2026-11-07부터) | `on`(켰는지), `category`, `where`(today: 오늘 소식 카드, library: 보관함 카드, header: 글 화면 머리말 아이콘, body: 글 화면 본문 '북마크' 버튼) |
| `ask` | 글 화면 맹고 AI(2026-11-03부터) | `category`, `action`(open: 맹고 AI 버튼을 눌러 창을 엶, voice: 마이크로 말하기 시작, answered: 답함, limit: 하루 횟수를 다 씀, error: 답을 못 받음) |
| `purchase_start` | 구독·맹고 추가 구매 결제 시작(앱) | `product`(스토어 상품 ID) |
| `purchase_complete` | 결제 끝남 | `product` |
| `try_start` | 로그인 없이 둘러보기(/try)에서 처음 듣기를 누름(2026-11-07부터) | `items`(둘러볼 소식 수), `mode`(all: 전체 듣기, item: 카드의 듣기), `where`(2026-11-10부터: hero 머리 카드의 큰 버튼, spot 처음 뜨는 안내, card 소식 카드) |
| `try_complete` | 둘러보기 마지막 소식까지 들어 체험 팝업이 뜸 | `heard`(들어 본 소식 수), `items` |
| `try_trial_click` | 둘러보기 'Premium 무료로 체험하기' | `where`(list: 목록 아래 카드, finish: 다 들은 뒤 팝업), `heard`, `items`, `signed_in` |
| `try_ask` | 둘러보기 맹고 AI(물으면 답 대신 가입 권유) | `action`(open: 창을 엶, send: 질문을 보냄, signup: 가입하고 물어보기) |
| `report_open` | 리포트를 열 때(리포트마다 한 번, 2026-11-10부터, Premium) | `kind`(week·month) |
| `report_make` | 리포트 '지금 만들기' | `kind`(week·month) |
| `app_install_click` | 웹에서 앱 받기를 누를 때(2026-11-11, `lib/app-install.ts`). 누르면 `/go/app`이 기기를 보고 App Store·Play로 보낸다. PC QR은 휴대폰이 찍어 바로 가므로 이 이벤트 대신 Vercel 로그 `go/app`(from=qr_landing·qr_side)과 Play 획득 보고서(utm_source=maengo_web)로 센다 | `where`(banner_landing·banner_share·banner_try·banner_topics·push_settings·listen_stopped, 11-11 더함: return_next_day 다음 날 다시 왔을 때·after_listen 브리핑을 다 들었을 때·report_end 리포트 맨 아래) |

## 볼 것(GA4 탐색)

- 유입경로: `login_start` → `onboarding_complete` → `today_build` → `item_open` 또는 `listen_start`
- 둘러보기: `try_start` → `try_complete` → `try_trial_click` → `login_start` → `onboarding_complete` → `purchase_start`
- 재방문: 코호트(가입 주별 1·7일 재방문)
- 기능별 사용: `listen_start`의 `mode` 비율, `script_tab_open`, 플레이리스트(`mode=playlist`)
- 분야별: `item_open`·`feedback`의 `category`
- 플랫폼별(web·ios·android) 차이
