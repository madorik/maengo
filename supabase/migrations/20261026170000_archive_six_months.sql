-- Premium 보관함을 6개월(180일)로 정하고, 그보다 오래된 받은 소식 기록은 지운다(2026-10-26 사용자 결정).
-- 1) plans.archive_days: Premium null(전부) → 180. Free는 같은 날 30일로(20261026170200_free_archive_30.sql)
-- 2) prune_archive(): 스케줄러 daily(00:05 KST)가 prune_storage 앞에서 매일 부른다(pipeline/src/scheduler.ts).
--    가장 긴 플랜 보관 기간(지금 Premium 180일, 오늘 포함)이 지난 날의 피드(feeds·feed_days)를 모든 회원에서 지운다.
--    Free는 보관함에서 기간으로만 거르고 180일까지 기록은 남겨서, Premium으로 올리면 6개월이 바로 보인다.
--    그 피드와 함께 보관함에서 사라지는 소식(남은 피드에 다시 없는 것)의 읽음 기록(reads)과 플레이리스트 항목도 지운다
--    (플레이리스트 재생은 받은 피드에 있는 소식만 튼다). 좋아요·싫어요(feedback)는 토픽 가중치와 싫어요한 소식 빼기에 쓰니 남긴다.
--    어느 플랜이든 보관 기간이 null(전부)이면 아무것도 지우지 않는다.
update public.plans set archive_days = 180, updated_at = now() where id = 'plus';

create or replace function public.prune_archive() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  keep_days int;
  cutoff date;
  n_feeds int;
  n_reads int;
  n_playlist int;
  n_days int;
begin
  select case when bool_or(archive_days is null) then null else max(archive_days) end into keep_days from public.plans;
  if keep_days is null then
    return jsonb_build_object('skipped', true);
  end if;
  cutoff := (now() at time zone 'Asia/Seoul')::date - (keep_days - 1);

  with gone as (
    delete from public.feeds where date < cutoff returning user_id, cluster_id
  ), dropped as (
    select distinct g.user_id, g.cluster_id from gone g
     where not exists (select 1 from public.feeds f where f.user_id = g.user_id and f.cluster_id = g.cluster_id and f.date >= cutoff)
  ), r as (
    delete from public.reads x using dropped d where x.user_id = d.user_id and x.cluster_id = d.cluster_id returning 1
  ), p as (
    delete from public.playlist_items x using dropped d where x.user_id = d.user_id and x.cluster_id = d.cluster_id returning 1
  )
  select (select count(*) from gone), (select count(*) from r), (select count(*) from p) into n_feeds, n_reads, n_playlist;

  delete from public.feed_days where date < cutoff;
  get diagnostics n_days = row_count;

  return jsonb_build_object('before', cutoff, 'feeds', n_feeds, 'feed_days', n_days, 'reads', n_reads, 'playlist', n_playlist);
end;
$$;
revoke execute on function public.prune_archive() from public, anon, authenticated;
