-- prune_storage(스케줄러 daily, 00:05 KST)가 2026-11-04부터 'canceling statement due to statement timeout'으로 날마다 실패했다.
-- API(PostgREST)로 부르면 문장 하나가 몇 초 안에 끝나야 하는데, 찾는 조건에 맞는 인덱스가 없어 표를 통째로 훑었다.
-- 글이 하루 약 2,700개씩 늘어 items 전체 훑기가 한도를 넘었다(무료 DB는 디스크 읽기가 느리다).
-- 1) 7일 지난 글 벡터 지우기: 벡터가 남은 글(수천 개)만 담는 부분 인덱스로 찾는다
-- 2) 30일 지난 묶음 찾기·벡터 지우기: clusters.last_seen_at 인덱스
-- 3) 글을 지울 때 clusters.rep_item_id(on delete set null)를 글마다 훑지 않게 인덱스
--    (11-08부터 10-09에 모은 글이 30일을 넘어 처음으로 지워지기 시작한다)
-- 4) 묶음을 지울 때 외래 키 확인용 cluster_id 인덱스(feedback·reads·playlist_items는 기본 키가 user_id로 시작한다)

create index if not exists items_embedded_fetched_idx on public.items (fetched_at) where embedding is not null;
create index if not exists clusters_last_seen_idx on public.clusters (last_seen_at);
create index if not exists clusters_rep_item_idx on public.clusters (rep_item_id);
create index if not exists feedback_cluster_idx on public.feedback (cluster_id);
create index if not exists reads_cluster_idx on public.reads (cluster_id);
create index if not exists playlist_items_cluster_idx on public.playlist_items (cluster_id);

-- 밀린 정리(11-04부터 못 지운 벡터 약 2,500개)를 지금 한 번 한다. SQL 편집기·db push는 API 시간 한도가 없다
select public.prune_storage();
