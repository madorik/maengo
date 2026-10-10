-- 오늘 피드를 누가 만들었나. 웹은 배치 전(자정~04시)이나 다시 만들기를 누르면 이미 요약된 소식으로 임시 피드를 만든다.
-- 배치(rank)는 웹이 만든 피드를 새 소식으로 다시 만들고, 배치가 만든 피드는 건너뛴다.
alter table public.feed_days add column built_by text not null default 'pipeline' check (built_by in ('pipeline','web'));
