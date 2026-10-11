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

- [ ] 결정: **누구에게**: 정식 출시 후 Free만(Premium은 광고 없음)? 베타 동안은 모두 Premium이라 Free만이면 지금은 아무도 안 본다
- [ ] 결정: **어디에**: (a) 앱 화면 위·아래 배너·전면·보상형(네이티브 플러그인, 웹 위에 겹쳐 뜬다) (b) 목록 사이 광고는 웹뷰 안이라 AdMob 네이티브 광고를 그대로 못 넣는다 → Google 모바일 광고 SDK의 WebView API로 웹의 애드센스·애드 매니저 광고를 앱에서 수익화 (c) 웹 브라우저는 AdMob이 아니라 AdSense(사이트 심사 따로)
- [ ] 사용자 준비: AdMob 계정, iOS·Android 앱 등록(앱 ID·광고 단위 ID)
- [ ] 구현: `@capacitor-community/admob`(Capacitor 8 호환 확인), `https://maengo.vercel.app/app-ads.txt`, iOS `NSUserTrackingUsageDescription`·SKAdNetwork 목록, 유럽 동의(UMP)
- [ ] 문서: 처리방침(광고 식별자, Google AdMob), Play '광고 포함'·데이터 보안(광고 ID), 애플 개인정보 라벨, 앱 다시 빌드·제출

## 메모

- 2026-10-11 문의 메일을 `wandeung.help@gmail.com`으로 바꿨다(`apps/web/lib/site.ts`). 스토어 콘솔에 넣은 연락처(Play 연락처·피드백 이메일, TestFlight 피드백 이메일)는 콘솔에서 직접 바꾼다
