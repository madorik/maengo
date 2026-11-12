-- 보관함은 2주(14일)만, 북마크한 소식은 계속(2026-11-12 사용자: "보관함에서 2주일 지난 뉴스는 제거하자 북마크 빼고. 어차피 다시 안보게돼").
-- 1) 플랜 보관 기간 Free·Premium 모두 14일(전: Free 30일·Premium 180일)
-- 2) prune_archive(매일 00:05): 14일 지난 피드를 지우되 북마크(reads.starred)한 소식의 피드 줄과 그날 feed_days는 남긴다
-- 3) library_page: 보관 기간 밖이어도 북마크한 소식은 보인다
update public.plans set archive_days = 14, updated_at = now() where id in ('free', 'plus');

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
    delete from public.feeds f
     where f.date < cutoff
       and not exists (select 1 from public.reads s where s.user_id = f.user_id and s.cluster_id = f.cluster_id and s.starred)
    returning f.user_id, f.cluster_id
  ), dropped as (
    select distinct g.user_id, g.cluster_id from gone g
     where not exists (select 1 from public.feeds f where f.user_id = g.user_id and f.cluster_id = g.cluster_id and (f.date >= cutoff
             or exists (select 1 from public.reads s where s.user_id = f.user_id and s.cluster_id = f.cluster_id and s.starred)))
  ), r as (
    delete from public.reads x using dropped d where x.user_id = d.user_id and x.cluster_id = d.cluster_id and not coalesce(x.starred, false) returning 1
  ), p as (
    delete from public.playlist_items x using dropped d where x.user_id = d.user_id and x.cluster_id = d.cluster_id returning 1
  )
  select (select count(*) from gone), (select count(*) from r), (select count(*) from p) into n_feeds, n_reads, n_playlist;

  -- 남은 줄(북마크)이 없는 날만 지운다(보관함이 feed_days.visible과 함께 읽는다)
  delete from public.feed_days d
   where d.date < cutoff
     and not exists (select 1 from public.feeds f where f.user_id = d.user_id and f.date = d.date);
  get diagnostics n_days = row_count;

  return jsonb_build_object('before', cutoff, 'feeds', n_feeds, 'feed_days', n_days, 'reads', n_reads, 'playlist', n_playlist);
end;
$$;
revoke execute on function public.prune_archive() from public, anon, authenticated;

create or replace function public.library_page(
  p_user uuid, p_today date, p_from date, p_category text, p_unread boolean, p_terms text[], p_page int, p_size int, p_overlap int,
  p_bookmarked boolean default false,
  p_section text default null
) returns jsonb
language sql stable security invoker set search_path = '' as $$
with shown as (
  select f.date, f.rank, f.cluster_id, f.topic_id, d.visible,
         row_number() over (partition by f.date order by f.rank) as rn
    from public.feeds f
    join public.feed_days d on d.user_id = f.user_id and d.date = f.date
   where f.user_id = p_user
     and (f.date = p_today or p_from is null or f.date >= p_from
          -- 북마크한 소식은 보관 기간이 지나도 보인다(2026-11-12)
          or exists (select 1 from public.reads rs where rs.user_id = p_user and rs.cluster_id = f.cluster_id and rs.starred))
),
base as (
  select s.date, s.rank, s.cluster_id, m.title, m.short, m.category, coalesce(m.author, i.author) as author, m.published_at,
         i.kind, i.canonical_url as url, coalesce(src.name, '') as source,
         (r.read_at is not null) as read, (r.listened_at is not null) as listened, coalesce(r.starred, false) as bookmarked,
         coalesce(
           case m.category
             when 'ai' then 'it-science' when 'tech' then 'it-science' when 'science' then 'it-science'
             when 'business' then 'economy' when 'marketing' then 'economy' when 'career' then 'economy'
             when 'finance' then 'economy' when 'crypto' then 'economy' when 'realestate' then 'real-estate'
             when 'politics' then 'politics' when 'society' then 'society' when 'world' then 'world'
             when 'entertainment' then 'entertainment' when 'sports' then 'sports'
             when 'design' then 'life-culture' when 'beauty' then 'life-culture' when 'food' then 'life-culture'
             when 'travel' then 'life-culture' when 'life' then 'life-culture'
           end,
           case when s.topic_id in ('politics','economy','society','life-culture','it-science','world','sports','entertainment','real-estate') then s.topic_id end
         ) as section
    from shown s
    join public.summaries m on m.cluster_id = s.cluster_id and m.tier = 'basic'
    join public.clusters c on c.id = s.cluster_id
    join public.items i on i.id = c.rep_item_id
    left join public.sources src on src.id = i.source_id
    left join public.reads r on r.user_id = p_user and r.cluster_id = s.cluster_id
   where s.rn <= s.visible
),
matched as (
  select b.* from base b
   where coalesce(array_length(p_terms, 1), 0) = 0
      or not exists (
        select 1 from unnest(p_terms) t
         where strpos(regexp_replace(lower(concat_ws(' ', b.title, b.short, b.source, coalesce(b.author, b.source))), '\s+', '', 'g'), t) = 0
      )
),
in_cat as (
  select * from matched
   where (p_category is null or category = p_category)
     and (p_section is null or section = p_section)
),
filtered as (
  select * from in_cat
   where (not p_unread or not (read or listened))
     and (not coalesce(p_bookmarked, false) or bookmarked)
),
paging as (
  select n, greatest(1, ceil(n::numeric / greatest(p_size, 1)))::int as page_count from (select count(*) as n from filtered) x
),
win as (
  select n, page_count, page,
         greatest(0, (page - 1) * p_size - p_overlap) as off,
         page * p_size - greatest(0, (page - 1) * p_size - p_overlap) as lim
    from (select n, page_count, least(greatest(1, p_page), page_count) as page from paging) c
)
select jsonb_build_object(
  'total', (select count(*) from base),
  'matched_total', (select count(*) from matched),
  'category_counts', (select coalesce(jsonb_object_agg(category, n), '{}'::jsonb) from (select category, count(*) as n from matched group by category) x),
  'section_counts', (select coalesce(jsonb_object_agg(section, n), '{}'::jsonb) from (select section, count(*) as n from matched where section is not null group by section) x),
  'in_category', (select count(*) from in_cat),
  'consumed', (select count(*) from in_cat where read or listened),
  'bookmarked', (select count(*) from in_cat where bookmarked),
  'filtered_total', (select n from win),
  'page', (select page from win),
  'page_count', (select page_count from win),
  'pick_ids', (select coalesce(jsonb_agg(cluster_id order by date desc, rank), '[]'::jsonb) from filtered),
  'entries', (select coalesce(jsonb_agg(to_jsonb(e) order by e.date desc, e.rank), '[]'::jsonb)
                from (select * from filtered order by date desc, rank offset (select off from win) limit (select lim from win)) e)
)
$$;
revoke execute on function public.library_page(uuid, date, date, text, boolean, text[], int, int, int, boolean, text) from public, anon, authenticated;
