-- 음성 듣기(audio)가 없는 플랜도 하루 몇 개는 '이 글 듣기'로 들어 본다(2026-10-23 사용자 결정, Free 하루 1개).
-- 핵심 기능(출퇴근에 듣기)을 Free가 한 번도 못 써 본 채 결제를 권하던 것을 바꾼다. 전체 듣기·플레이리스트는 그대로 Premium만.
-- audio = true인 플랜은 이 값과 상관없이 다 듣는다. 하루는 KST, 센 기준은 reads.listened_at(처음 들은 시각)이 오늘인 소식 수.
-- 전에 들은 소식을 다시 듣는 건 세지 않는다(음성 파일이 이미 있다). 코드: apps/web/lib/server/listen-access.ts
alter table public.plans add column if not exists daily_listens int not null default 0 check (daily_listens >= 0);
update public.plans set daily_listens = 1, updated_at = now() where id = 'free';
