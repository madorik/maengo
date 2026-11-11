-- 분야 9개(2026-11-11 사용자 '온보딩에 부동산도'): 부동산을 경제에서 따로 뺀다. packages/core/src/sections.ts·topics/dictionary.ts와 같다.
-- 1) 뉴스 분야 토픽 'real-estate'(부동산 섹션 RSS 4곳의 헤드라인이 붙는다, pipeline sources.ts)
-- 2) 보관함 library_page의 분야 셈: 글 종류 realestate → 부동산(전에는 경제), 받은 토픽이 분야면 그 분야 목록에 real-estate도
insert into public.topics (id, name, aliases, popularity)
values ('real-estate', '부동산', array['부동산 뉴스', '아파트', '청약', '분양', '집값', '전세', '재건축']::text[], 13)
on conflict (id) do update set name = excluded.name, aliases = excluded.aliases, popularity = excluded.popularity, parent = null, custom = false, embedding = null;

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
     and (f.date = p_today or p_from is null or f.date >= p_from)
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
