# 맹고 사용 패턴 분석(GTM + GA4)

> 2026-10-11. 코드는 끝났고(이벤트가 `window.dataLayer`에 쌓인다), GTM 컨테이너 ID를 넣으면 GA4로 가기 시작한다.
> 코드: `lib/analytics.ts`(track), `components/Analytics.tsx`(GTM 싣기, 운영 + `NEXT_PUBLIC_GTM_ID`일 때만), `components/AnalyticsSession.tsx`(사용자 ID·플랜·플랫폼).
> 개인정보: 이름·이메일·직접 적은 관심사는 보내지 않는다. 사용자 ID는 회원 id의 SHA-256 앞 24자리. 처리방침에 Google 애널리틱스를 넣었다(2026-10-11).

## 사용자가 할 일

1. **GA4 속성**: https://analytics.google.com → 관리 → 만들기 → 속성 `맹고`(시간대 대한민국, 통화 원) → 데이터 스트림 '웹' → `https://maengo.vercel.app` → 측정 ID(`G-…`)
   - 관리 → 데이터 수집 및 수정 → 데이터 보관 → **14개월**(처리방침과 같게)
2. **GTM 컨테이너**: https://tagmanager.google.com → 계정 만들기 `맹고` → 컨테이너 `maengo.vercel.app`, 대상 '웹' → 컨테이너 ID(`GTM-…`)를 Claude에게 알려 준다(Vercel 환경 변수 `NEXT_PUBLIC_GTM_ID`에 넣고 배포)
3. **GTM 안 설정**(아래 '태그 설정') → 제출 → 게시
4. **GA4 맞춤 정의**: 관리 → 맞춤 정의 → 이벤트 범위 `mode`·`category`·`kind`·`action`·`reason`·`topic`·`voice`·`provider`, 사용자 범위 `plan`·`platform`

## 태그 설정(GTM)

- **변수**(데이터 영역 변수, 버전 2): `user_id`, `plan`, `platform`, `provider`, `mode`, `count`, `category`, `kind`, `today`, `topics`, `reason`, `action`, `group`, `picks`, `topic`, `on`, `voice` — 이름을 각각 `dlv - 이름`으로
- **Google 태그**: 태그 ID `G-…`, 트리거 'Initialization - All Pages'. 페이지 이동은 GA4 향상된 측정의 '브라우저 기록 이벤트 기반 페이지 변경'(기본 켜짐)이 잡는다
- **GA4 이벤트 태그 하나**: 측정 ID `G-…`, 이벤트 이름 `{{Event}}`
  - 이벤트 매개변수: `user_id`·`provider`·`mode`·`count`·`category`·`kind`·`today`·`topics`·`reason`·`action`·`group`·`picks`·`topic`·`on`·`voice` ← 같은 이름의 변수
  - 사용자 속성: `plan` ← `{{dlv - plan}}`, `platform` ← `{{dlv - platform}}`
  - 트리거: 맞춤 이벤트, 이벤트 이름 정규식 일치
    `^(identify|login_start|onboarding_complete|today_build|item_open|source_open|listen_start|listen_complete|script_tab_open|feedback|topic_edit|notify_toggle|push_open|voice_change)$`

## 이벤트

| 이벤트 | 언제 | 값 |
| --- | --- | --- |
| `identify` | 로그인한 화면을 열 때 | `user_id`(해시), `plan`(plus·free), `platform`(web·ios·android) |
| `login_start` | 구글·애플 로그인 버튼 | `provider` |
| `onboarding_complete` | 온보딩 '시작하기' | `topics`(고른 개수) |
| `today_build` | '오늘 맹고 받기' | `reason`(first·waiting·exhausted) |
| `item_open` | 글 상세를 열 때 | `category`, `kind`(article·video), `today`(오늘 피드인지) |
| `source_open` | 원문 링크 | `category`, `kind` |
| `listen_start` | 듣기 시작 | `mode`(today·today_one·item·playlist), `count`(플레이리스트 개수) |
| `listen_complete` | 끝까지 들음 | `mode`(today·item·playlist) |
| `script_tab_open` | 듣기 창 '대본' 탭 | `mode` |
| `feedback` | 좋아요·싫어요 | `kind`(more·skip·clear) |
| `topic_edit` | 관심사 고치기 | `action`(group·add·remove·text), `group`, `picks`, `topic`(직접 적은 건 custom) |
| `notify_toggle` | 알림 켜고 끄기 | `on` |
| `push_open` | 알림을 눌러 들어옴(`?from=push`) | — |
| `voice_change` | 목소리 바꾸기(설정) | `voice`(f·m) |

## 볼 것(GA4 탐색)

- 유입경로: `login_start` → `onboarding_complete` → `today_build` → `item_open` 또는 `listen_start`
- 재방문: 코호트(가입 주별 1·7일 재방문)
- 기능별 사용: `listen_start`의 `mode` 비율, `script_tab_open`, 플레이리스트(`mode=playlist`)
- 분야별: `item_open`·`feedback`의 `category`
- 플랫폼별(web·ios·android) 차이
