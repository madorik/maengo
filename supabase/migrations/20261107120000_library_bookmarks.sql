-- 소식 북마크(2026-11-07 사용자 요청: 보관함에서 '북마크'를 고르면 북마크한 소식만).
-- 새 표 없이 init 때부터 있던 reads.starred(쓰지 않던 '별표' 칸)를 북마크로 쓴다. 쓰기는 웹이 서버 키로만 한다(apps/web/lib/server/feed.ts setBookmark).
-- 보관 기간은 보관함과 같다: 플랜 보관 기간(Free 30일·Premium 6개월) 밖의 소식은 북마크해도 보관함에 안 보이고,
-- 180일이 지나 prune_archive가 그 소식의 reads를 지울 때 북마크도 같이 사라진다(맹고-문서/북마크.md).
--
-- library_page에 p_bookmarked(북마크한 소식만)를 더하고, 거르기 줄의 '북마크' 개수(지금 카테고리 안)를 돌려준다.
-- 인자 목록이 바뀌어 예전 함수를 지우고 새로 만든다(이름이 같은 함수가 둘이면 PostgREST가 어느 쪽인지 못 고른다).
-- p_bookmarked는 기본값 false라 이 마이그레이션을 먼저 적용해도 예전 웹(인자 9개)이 그대로 부른다.
drop function if exists public.library_page(uuid, date, date, text, boolean, text[], int, int, int);

create function public.library_page(
  p_user uuid, p_today date, p_from date, p_category text, p_unread boolean, p_terms text[], p_page int, p_size int, p_overlap int,
  p_bookmarked boolean default false
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
         (r.read_at is not null) as read, (r.listened_at is not null) as listened, coalesce(r.starred, false) as bookmarked
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
revoke execute on function public.library_page(uuid, date, date, text, boolean, text[], int, int, int, boolean) from public, anon, authenticated;

