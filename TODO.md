# 맹고 TODO

> 2026-10-11 작성. 끝나면 `[x]`로 바꾸고 날짜·커밋을 적는다. 셋 다 처리방침·스토어 개인정보 항목이 바뀌므로 그 일도 같이 한다.
> 권하는 순서: 관리자 페이지(외부 준비 없음) → 사용 패턴 분석 → 광고(앱 다시 제출이 필요해 다음 앱 버전에 묶는다).

## 1. 관리자 페이지(사용량 통계)

목표: 운영 상태·사용량·비용을 한 화면에서 본다.

- [ ] 접근: `/admin`. 로그인 + 환경 변수 `ADMIN_EMAILS`(쉼표)에 있는 이메일만, 나머지는 404. 집계는 서버에서만(service role), `noindex`
- [ ] 회원: 전체·오늘 가입·최근 14일 일별 가입, 온보딩 완료율, 플랜 분포, 알림 켬 비율(`profiles`)
- [ ] 활동: DAU·WAU(읽음·들음 기록 기준, `reads`), 오늘 맹고를 받은 사람(`feed_days`), 읽음·들음 수, 좋아요·싫어요 비율(`feedback`)
- [ ] 콘텐츠: 오늘 수집한 글·요약 수(`items`·`summaries`), 분야별 관심사 분포(`user_topics`), 기타로 적은 말 상위
- [ ] 비용: Gemini 추정 비용 일·월(`usage_log` provider gemini, `est_usd`), TTS 글자 수 월 누계와 무료 100만 자 대비 %(`usage_log` provider google kind tts, `units`), 새로 만든 음성 수(kind voice)
- [ ] 운영: 스케줄러 작업별 다음 차례·마지막 결과·오류(`scheduler_tasks`), 오늘 알림 상태별 개수 sent·muted·no_device·failed(`delivery_jobs`), 기기 토큰 수 플랫폼별(`device_tokens`)
- 지금 기록이 없는 것(화면 열기, 플레이리스트 재생, 들은 시간 등)은 2번 분석에서 보거나, 필요하면 `events` 표를 따로 둔다

## 2. 사용 패턴 분석(GTM + GA4)

목표: 어떤 기능을 쓰고 어디서 그만두는지 보고 개선 방향을 정한다.

- [ ] 사용자 준비: GTM 계정·컨테이너, GA4 속성 → `NEXT_PUBLIC_GTM_ID`(Vercel·`.env.local`)
- [ ] 웹에 GTM(루트 레이아웃, 운영에서만). 앱은 같은 웹을 띄우므로 그대로 돈다. 플랫폼은 UA의 `MaengoApp/`로 사용자 속성 `platform`(web·ios·android)
- [ ] 이벤트(코드에서 `dataLayer.push`): `login`(provider), `onboarding_complete`(분야 수), `today_open`, `today_build`('오늘 맹고 받기'), `item_open`, `source_open`(원문), `listen_start`·`listen_complete`(오늘 전체·하나·플레이리스트), `playlist_play`(개수), `script_tab_open`, `feedback`(more·skip), `topic_add`·`topic_remove`, `notify_toggle`, `push_open`(`?from=push`), `voice_change`
- [ ] 사용자 ID는 Supabase id의 해시만(이메일·이름은 보내지 않는다)
- [ ] 볼 것: 가입 → 온보딩 → 첫 '오늘 맹고 받기' → 첫 읽음·듣기 퍼널, 7일 재방문, 기능별 사용 비율(듣기·플레이리스트·대본), 분야별 이탈
- [ ] 문서: 처리방침 8번 "광고·방문 분석 쿠키는 쓰지 않습니다" 고치기, 위탁·국외 이전에 Google(애널리틱스) 추가, Play 데이터 보안(앱 활동·기기 ID를 '분석' 목적으로), 애플 개인정보 라벨. 앱에서 광고 식별자(IDFA)를 쓰지 않으면 iOS 추적 동의(ATT)는 필요 없다

## 3. 광고(AdMob)

**정한 것(2026-10-11 사용자)**
- 누구에게: 베타 동안은 모두에게 보인다. 정식 출시 후에는 Free에게만(Premium은 광고 없음). → `packages/core/src/plans.ts`에 `showAdsFor(plan)` 하나로 둔다(`BETA`면 true, 아니면 `plan === 'free'`)
- 어디에: 사용성을 해치지 않는 곳. 아래 원칙과 자리로 시작하고, 2번 분석에서 이탈이 늘면 줄인다

**원칙**
- 읽거나 듣는 중에는 띄우지 않는다(글 상세·듣기 화면·대본 보는 중, 재생 중 전면 광고 없음)
- 누를 것(버튼·듣기 창) 옆에 붙이지 않는다(잘못 누르기 방지, 애드몹 정책상 실수 클릭 유도 금지)
- 전면 광고는 하루 한 번까지, 자연스럽게 끝나는 순간에만

**자리(앱)**
- [ ] **오늘·보관함 목록 맨 아래 배너**(적응형 배너, 화면 아래 고정). 오른쪽 아래 듣기 창은 배너 높이만큼 위로 올린다(CSS 변수). 글 상세(아래 듣기 막대가 있음)·듣기 화면·설정·로그인·온보딩에는 띄우지 않는다
- [ ] **오늘 맹고를 다 봤을 때 전면 광고 한 번**: '오늘은 여기까지예요' 순간(오늘 목록·듣기 화면의 완료 상태). 하루 한 번, 재생 중이면 건너뜀
- 목록 카드 사이에 넣는 광고는 웹뷰 안이라 애드몹으로는 못 한다. 하려면 애드센스 + 'Google 모바일 광고 SDK WebView API'가 필요하고, 애드센스는 내 도메인이 있어야 한다(`*.vercel.app`은 안 됨) → 도메인을 산 뒤에 검토

**웹(브라우저)**
- 애드몹은 앱 전용. 웹 광고는 애드센스(도메인 필요, 사이트 심사)라 도메인을 산 뒤에

**할 일**
- [ ] 사용자 준비: AdMob 계정, iOS·Android 앱 등록 → 앱 ID 2개, 광고 단위 ID(배너·전면) 플랫폼별
- [ ] 구현: `@capacitor-community/admob`(Capacitor 8 호환 확인), 개발 중에는 구글 테스트 광고 ID, `showAdsFor`로 켜고 끄기, 듣기 창 위치 조정
- [ ] `https://maengo.vercel.app/app-ads.txt`(애드몹 게시자 ID)
- [ ] iOS: `NSUserTrackingUsageDescription`(추적 동의 문구, 거절해도 비개인화 광고), SKAdNetwork ID 목록(Info.plist), 유럽 동의(UMP)는 애드몹 기본으로
- [ ] 문서: 처리방침(광고 식별자, Google AdMob 위탁·국외 이전, 쿠키 문구), Play '광고 포함' 예 + 데이터 보안(기기 또는 기타 ID: 광고·분석), 애플 개인정보 라벨, 앱 다시 빌드·제출(앱 버전 1.1)

## 메모

- 2026-10-11 문의 메일을 `wandeung.help@gmail.com`으로 바꿨다(`apps/web/lib/site.ts`). 스토어 콘솔에 넣은 연락처(Play 연락처·피드백 이메일, TestFlight 피드백 이메일)는 콘솔에서 직접 바꾼다
