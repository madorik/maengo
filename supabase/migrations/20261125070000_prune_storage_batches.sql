-- 하루 정리(스케줄러 daily, 00:05 KST)가 2026-11-15부터 prune_storage에서 'canceling statement due to statement timeout'으로 날마다 실패했다.
-- API(PostgREST)는 문장 하나를 8초(authenticator statement_timeout)에 끊는데, prune_storage는 하루치를 한 문장으로 지웠다.
-- 글이 하루 약 4,300개(출처 146곳)로 늘어 하루치만 해도 평균 5.3초·최대 8초에 닿았고, 한 번 실패하자 밀린 양이 쌓여 다시는 못 끝냈다.
-- 2026-11-25 밀린 양: 7일 지난 글 벡터 15,628개, 지울 글 33,658개, 지울 묶음 12,525개, 30일 지난 묶음 벡터 12,708개.
-- 묶음 벡터가 안 지워져 clusters가 커지자 수집의 태그 단계(묶음 1만여 개 벡터 읽기)도 8초에 걸려 실패가 늘었다(pipeline/src/jobs/tag.ts에서 따로 고친다).
--
-- 1) prune_storage(p_limit): 단계마다 p_limit개(묶음은 그 절반)까지만 지우고, 더 남았으면 more=true. 스케줄러가 남은 시간 안에서 되풀이해 부른다
-- 2) 밀린 양은 지금 한 번에 지운다. db push는 API 시간 한도가 없다

drop function if exists public.prune_storage();

create or replace function public.prune_storage(p_limit int default 500) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  week  timestamptz := now() - interval '7 days';
  month timestamptz := now() - interval '30 days';
  cluster_limit int := greatest(1, p_limit / 2);
  gone  bigint[];
  n_item_vecs int;
  n_items int;
  n_orphans int;
  n_clusters int;
  n_cluster_vecs int;
begin
  -- 글 벡터: 받은 지 7일 지난 것(부분 인덱스 items_embedded_fetched_idx)
  update public.items set embedding = null
   where id in (select i.id from public.items i where i.embedding is not null and i.fetched_at < week order by i.fetched_at limit p_limit);
  get diagnostics n_item_vecs = row_count;

  -- 요약·피드·피드백·읽음·플레이리스트 어디에도 안 쓰인 30일 지난 묶음과 그 글.
  -- 발행일이 최근이거나 없는 글은 남기고 묶음만 뗀다(피드가 날짜 없는 글을 새 글로 다시 넣지 않게 주소를 기억한다)
  select coalesce(array_agg(g.id), '{}') into gone from (
    select c.id from public.clusters c
     where c.last_seen_at < month
       and not exists (select 1 from public.summaries s where s.cluster_id = c.id)
       and not exists (select 1 from public.feeds f where f.cluster_id = c.id)
       and not exists (select 1 from public.feedback b where b.cluster_id = c.id)
       and not exists (select 1 from public.reads r where r.cluster_id = c.id)
       and not exists (select 1 from public.playlist_items p where p.cluster_id = c.id)
     order by c.last_seen_at
     limit cluster_limit) g;

  delete from public.items i
   where i.cluster_id = any(gone) and i.fetched_at < month and i.published_at < month;
  get diagnostics n_items = row_count;

  update public.items set cluster_id = null where cluster_id = any(gone);
  delete from public.clusters where id = any(gone);
  get diagnostics n_clusters = row_count;

  -- 묶음이 없는 30일 지난 글
  delete from public.items
   where id in (select i.id from public.items i where i.cluster_id is null and i.fetched_at < month and i.published_at < month limit p_limit);
  get diagnostics n_orphans = row_count;

  -- 30일 지난 묶음 벡터. '이미 알아요'를 누른 묶음의 centroid는 남긴다(비슷한 새 소식을 빼는 데 쓴다)
  update public.clusters c
     set centroid = case when exists (select 1 from public.feedback b where b.cluster_id = c.id and b.kind = 'known') then c.centroid end,
         summary_vec = null
   where c.id in (
     select x.id from public.clusters x
      where x.last_seen_at < month
        and (x.summary_vec is not null
             or (x.centroid is not null and not exists (select 1 from public.feedback b where b.cluster_id = x.id and b.kind = 'known')))
      order by x.last_seen_at
      limit p_limit);
  get diagnostics n_cluster_vecs = row_count;

  return jsonb_build_object(
    'item_vecs', n_item_vecs, 'items', n_items + n_orphans, 'clusters', n_clusters, 'cluster_vecs', n_cluster_vecs,
    'more', n_item_vecs >= p_limit or n_clusters >= cluster_limit or n_orphans >= p_limit or n_cluster_vecs >= p_limit);
end;
$$;

revoke execute on function public.prune_storage(int) from public, anon, authenticated;

-- 밀린 정리를 지금 한 번에 한다(운영엔 2026-11-25 Management API로 2,000·5,000개씩 나눠 먼저 돌렸다. 다시 돌려도 남은 것만 지운다)
select public.prune_storage(1000000);
