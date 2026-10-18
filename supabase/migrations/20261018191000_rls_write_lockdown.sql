-- 클라이언트 쓰기 막기(2026-10-18 점검). init의 '본인 행만 읽고 쓰는 표' 정책(for all)은 로그인한 사람이 공개 anon 키와
-- 자기 Supabase JWT로 PostgREST에 바로 쓸 수 있게 열어 두었다: 관심사 개수 한도·Premium 전용 내 관심 링크(user_topics 's-…')를 건너뛰고,
-- 읽음·피드백·기기 토큰을 마음대로 넣을 수 있었다.
-- 웹·파이프라인은 이 표들을 모두 서버 키(service role, apps/web/lib/server/db.ts·pipeline/src/lib/db.ts)로만 읽고 쓴다.
-- 로그인 세션 클라이언트(apps/web/lib/supabase/server.ts, proxy.ts)는 로그인·세션 확인(auth.*)에만 쓰고 표에는 손대지 않는다.
-- 그래서 쓰기 정책과 권한을 빼고, 본인 행 읽기만 남긴다(지금 읽는 곳은 없지만 남겨도 새는 것이 없다). service role은 RLS를 건너뛰어 그대로 쓴다.

-- 1. 본인 행만 읽고 쓰던 표 → 본인 행 읽기만
drop policy if exists "본인 토픽" on public.user_topics;
drop policy if exists "본인 피드백" on public.feedback;
drop policy if exists "본인 읽음" on public.reads;
drop policy if exists "본인 기기" on public.device_tokens;

create policy "본인 토픽 보기" on public.user_topics for select to authenticated using ((select auth.uid()) = user_id);
create policy "본인 피드백 보기" on public.feedback for select to authenticated using ((select auth.uid()) = user_id);
create policy "본인 읽음 보기" on public.reads for select to authenticated using ((select auth.uid()) = user_id);
create policy "본인 기기 보기" on public.device_tokens for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete, truncate on public.user_topics, public.feedback, public.reads, public.device_tokens from anon, authenticated;

-- 2. 프로필 설정값 고치기(이름·알림 시각·목소리 등)도 웹이 서버 키로 한다(app/actions.ts). 직접 고치는 길을 닫는다(보기는 그대로)
drop policy if exists "본인 프로필 고치기" on public.profiles;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
