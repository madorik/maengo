-- 보관함을 DB에서 쪽 단위로 읽는다(2026-10-19 사용자 결정: 전체를 읽어 메모리에서 거르지 않고 10개씩).
-- 받은 피드(그날 feed_days.visible개까지, 플랜이 보여 주는 기간 p_from부터. 오늘 p_today는 늘)에서 검색어·카테고리·안 읽음으로 거르고,
-- 거르기 줄의 개수(전체·카테고리별·안 읽음)와 '골라 듣기 전체'용 id 목록, 요청한 쪽의 소식을 한 번에 돌려준다(apps/web/lib/server/feed.ts getLibrary).
-- 검색은 apps/web/lib/library-search.ts와 같은 규칙: 제목·요약·출처·글쓴이를 소문자로 하고 띄어쓰기를 뺀 글에 낱말(p_terms)이 모두 들어가야 한다.
-- 쪽 번호가 쪽 수를 넘으면 마지막 쪽으로 맞추고, p_overlap만큼 앞 쪽 소식을 겹쳐 준다(앱 이어 붙이기. 받는 사이 목록이 줄어도 건너뛰지 않게).
-- 대표 글(clusters.rep_item_id)이 출처·주소가 된다. 요약이나 대표 글이 없는 묶음은 뺀다.
-- 사람 id를 받으므로 서버 키로만 부른다(anon·authenticated는 못 부르게).
create or replace function public.library_page(
  p_user uuid, p_today date, p_from date, p_category text, p_unread boolean, p_terms text[], p_page int, p_size int, p_overlap int
) returns jsonb
language sql stable security invoker set search_path = '' as $$
with shown as (
  select f.date, f.rank, f.cluster_id, d.visible,
         row_number() over (partition by f.date order by f.rank) as rn
    from public.feeds f
    join public.feed_days d on d.user_id = f.user_id and d.date = f.date
   where f.user_id = p_user
     and (f.date = p_today or p_from is null or f.date >= p_from)
),
base as (
  select s.date, s.rank, s.cluster_id, m.title, m.short, m.category, coalesce(m.author, i.author) as author, m.published_at,
         i.kind, i.canonical_url as url, coalesce(src.name, '') as source,
         (r.read_at is not null) as read, (r.listened_at is not null) as listened
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
in_cat as (select * from matched where p_category is null or category = p_category),
filtered as (select * from in_cat where not p_unread or not (read or listened)),
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
  'in_category', (select count(*) from in_cat),
  'consumed', (select count(*) from in_cat where read or listened),
  'filtered_total', (select n from win),
  'page', (select page from win),
  'page_count', (select page_count from win),
  'pick_ids', (select coalesce(jsonb_agg(cluster_id order by date desc, rank), '[]'::jsonb) from filtered),
  'entries', (select coalesce(jsonb_agg(to_jsonb(e) order by e.date desc, e.rank), '[]'::jsonb)
                from (select * from filtered order by date desc, rank offset (select off from win) limit (select lim from win)) e)
)
$$;
revoke execute on function public.library_page(uuid, date, date, text, boolean, text[], int, int, int) from public, anon, authenticated;
