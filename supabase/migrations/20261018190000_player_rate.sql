-- 재생 속도를 프로필에 남긴다(2026-10-18). 오늘 브리핑 플레이어와 글 하나 듣기가 이 속도로 시작하고, 속도를 바꾸면 savePlayerPrefs가 고친다.
-- 앱이 고르는 값은 1·1.2·1.5·0.8배(apps/web/lib/player/rate.ts)뿐이고 서버도 그 값만 받는다. 실수형이라 제약은 범위로 둔다
alter table public.profiles add column playback_rate real not null default 1 check (playback_rate between 0.5 and 2);
