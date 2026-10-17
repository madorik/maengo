-- 저장 공간 C안(2026-10-17 사용자 결정): Supabase 무료 500MB 안에서 멈추게 한다(그날 203MB, 3시간 수집 때 하루 약 35MB씩 늘었다).
-- 1) items_embedding_idx(HNSW, 약 54MB) 삭제: 유사도는 전부 파이프라인(TS) 메모리에서 계산해 이 인덱스를 쓰는 조회가 없다.
-- 2) prune_storage(): 스케줄러 daily(00:05 KST)가 매일 부른다.
--    - 글 벡터: 받은 지 7일 지나면 지운다. 수집·임베딩·묶기는 최근 72시간만 보고, 그 뒤로는 묶음 대표 벡터만 쓴다
--    - 묶음 벡터(centroid·summary_vec): 마지막으로 본 지 30일 지나면 지운다. 피드 찾기는 한 달까지만 본다.
--      '이미 알아요'를 누른 묶음의 centroid는 남긴다(비슷한 새 소식을 빼는 데 쓴다)
--    - 요약 안 된 묶음과 그 글: 30일 지나면 행째 지운다. 요약된 묶음은 피드·보관함·듣기가 쓰니 남긴다.
--      발행일 없는 글은 남긴다(피드가 날짜 없는 글을 새 글로 다시 넣지 않게 주소를 기억한다)
-- 3) 벡터 열 4개를 halfvec(반정밀도)로: 크기가 절반. 열 형식을 바꾸며 표를 다시 써서 지운 자리도 돌려받는다.

drop index if exists public.items_embedding_idx;

create or replace function public.prune_storage() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  week  timestamptz := now() - interval '7 days';
  month timestamptz := now() - interval '30 days';
  gone  bigint[];
  n_item_vecs int;
  n_items int;
  n_clusters int;
  n_cluster_vecs int;
begin
  update public.items set embedding = null where embedding is not null and fetched_at < week;
  get diagnostics n_item_vecs = row_count;

  select coalesce(array_agg(c.id), '{}') into gone
    from public.clusters c
   where c.last_seen_at < month
     and not exists (select 1 from public.summaries s where s.cluster_id = c.id)
     and not exists (select 1 from public.feeds f where f.cluster_id = c.id)
     and not exists (select 1 from public.feedback b where b.cluster_id = c.id)
     and not exists (select 1 from public.reads r where r.cluster_id = c.id)
     and not exists (select 1 from public.playlist_items p where p.cluster_id = c.id);

  delete from public.items i
   where i.fetched_at < month
     and i.published_at < month
     and (i.cluster_id is null or i.cluster_id = any(gone));
  get diagnostics n_items = row_count;

  update public.items set cluster_id = null where cluster_id = any(gone);
  delete from public.clusters where id = any(gone);
  get diagnostics n_clusters = row_count;

  update public.clusters c
     set centroid = case when exists (select 1 from public.feedback b where b.cluster_id = c.id and b.kind = 'known') then c.centroid end,
         summary_vec = null
   where c.last_seen_at < month
     and (c.summary_vec is not null
          or (c.centroid is not null and not exists (select 1 from public.feedback b where b.cluster_id = c.id and b.kind = 'known')));
  get diagnostics n_cluster_vecs = row_count;

  return jsonb_build_object('item_vecs', n_item_vecs, 'items', n_items, 'clusters', n_clusters, 'cluster_vecs', n_cluster_vecs);
end;
$$;

revoke execute on function public.prune_storage() from public, anon, authenticated;

select public.prune_storage();

alter table public.items
  alter column embedding type extensions.halfvec(768) using embedding::extensions.halfvec(768);
alter table public.clusters
  alter column centroid type extensions.halfvec(768) using centroid::extensions.halfvec(768),
  alter column summary_vec type extensions.halfvec(768) using summary_vec::extensions.halfvec(768);
alter table public.topics
  alter column embedding type extensions.halfvec(768) using embedding::extensions.halfvec(768);

create or replace function public.set_item_embeddings(p jsonb) returns int
language sql security invoker set search_path = '' as $$
  with u as (
    update public.items i set embedding = (e->>'v')::extensions.halfvec
    from jsonb_array_elements(p) e
    where i.id = (e->>'id')::bigint
    returning 1
  )
  select count(*)::int from u;
$$;

revoke execute on function public.set_item_embeddings(jsonb) from public, anon, authenticated;
