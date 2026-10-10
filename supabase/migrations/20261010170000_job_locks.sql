-- 여러 서버(웹 요청)가 같은 배치 일을 겹쳐 하지 않게 하는 잠금. 'pipeline:fresh' = 즉석 피드가 최근 글을 수집·임베딩·묶기·태그하는 중.
-- 오래된 잠금(서버가 죽은 경우)은 부르는 쪽이 started_at을 보고 가져간다.
create table public.job_locks (
  key         text primary key,
  started_at  timestamptz not null default now()
);
alter table public.job_locks enable row level security;
