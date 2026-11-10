-- 분야 8개(2026-11-10 사용자): 정치·경제·사회·생활/문화·IT/과학·세계 + 스포츠·엔터('연예'가 아니라 '엔터').
-- 사용자는 키워드를 고르지 않고 이 8개 분야의 비중만 갖는다(맹고-문서/맞춤-소식.md). 새 두 분야도 다른 뉴스 분야처럼
-- 여러 언론사가 같이 다룬 소식(헤드라인)만 붙는다(pipeline tag.ts의 tagHeadlines). packages/core/src/topics/dictionary.ts와 같다.
insert into public.topics (id, name, aliases, popularity)
select id, name, aliases, popularity from (values
  ('sports', '스포츠', array['스포츠 뉴스', '야구', '축구', '골프', '농구', '배구']::text[], 11),
  ('entertainment', '엔터', array['연예', '엔터테인먼트', '드라마', '영화', '음악', '방송', 'K팝']::text[], 12)
) as v(id, name, aliases, popularity)
on conflict (id) do update set name = excluded.name, aliases = excluded.aliases, popularity = excluded.popularity, parent = null, custom = false, embedding = null;
