-- 소식의 무게(2026-10-27 사용자 결정: 새 기술이나 사회에 영향을 주는 소식을 먼저, AI는 새 모델 출시·보안 위협이 맨 앞).
-- 요약할 때 AI가 매긴다(프롬프트 9판). major: 일·돈·안전에 바로 영향을 주거나 판도를 바꾸는 소식, notable: 새로 나오거나 바뀌는 것이 있는 소식,
-- routine: 전망·의견·후기처럼 바뀌는 게 없는 소식. 비어 있으면(이전 요약) 랭킹이 제목 낱말로 본다(packages/core/src/feed/impact.ts).
-- 요약을 저장하는 코드가 이 열에 쓰므로 코드보다 먼저 올린다.
alter table public.summaries add column if not exists impact text check (impact in ('major', 'notable', 'routine'));
