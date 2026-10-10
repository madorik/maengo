-- 관심 분야 v3(2026-10-11): K-Pop·K-뷰티·K-푸드를 빼고, 네이버 뉴스 섹션과 같은 뉴스 분야 6개를 더한다. 개발은 이름을 Tech로 바꾼다.
-- 정치 · 경제 · 사회 · 생활/문화 · IT/과학 · 세계. 상세 관심사는 없고, 여러 언론사가 같이 다룬 소식(헤드라인)만 받는다
-- (pipeline tag.ts의 tagHeadlines가 붙인다. 임베딩·AI 태그는 쓰지 않는다).
-- packages/core/src/topics/dictionary.ts와 같다.

-- 1) 뉴스 분야
insert into public.topics (id, name, aliases, popularity)
select id, name, aliases, popularity from (values
  ('politics', '정치', array['정치 뉴스', '국회', '정당']::text[], 6),
  ('economy', '경제', array['경제 뉴스', '경제 동향']::text[], 7),
  ('society', '사회', array['사회 뉴스', '사건사고', '사건·사고']::text[], 8),
  ('life-culture', '생활/문화', array['생활', '문화', '생활 뉴스', '문화 뉴스']::text[], 9),
  ('it-science', 'IT/과학', array['IT', '과학', 'IT 뉴스', '과학 뉴스']::text[], 10),
  ('world', '세계', array['국제', '국제 뉴스', '해외 뉴스', '세계 뉴스']::text[], 10)
) as v(id, name, aliases, popularity)
on conflict (id) do update set name = excluded.name, aliases = excluded.aliases, popularity = excluded.popularity, parent = null, custom = false, embedding = null;

-- 1-1) 개발 → Tech. 예전 이름은 별칭으로 남긴다. 이름이 바뀌어 토픽 벡터는 다시 만든다(이미 만든 why 문구는 그대로 둔다)
update public.topics
set name = 'Tech', aliases = array['개발', '테크', '소프트웨어 개발', '프로그래밍', '개발자', '백엔드', '프론트엔드', 'DevOps']::text[], embedding = null
where id = 'dev';

-- 2) K-Pop·K-뷰티·K-푸드 토픽과 그 기록을 지운다(예전 값은 옮기지 않는다)
create temporary table k_topics (id text primary key);
insert into k_topics (id) values
  ('kpop'), ('kbeauty'), ('kfood'),
  ('kpop-release'), ('kpop-chart'), ('kpop-concert'),
  ('beauty-new'), ('beauty-trend'), ('beauty-export'),
  ('food-new'), ('food-franchise'), ('food-export');

delete from public.feeds where topic_id in (select id from k_topics);
update public.feedback set topic_id = null where topic_id in (select id from k_topics);
delete from public.cluster_why where topic_id in (select id from k_topics);
delete from public.cluster_topics where topic_id in (select id from k_topics);
delete from public.user_topics where topic_id in (select id from k_topics);
-- 상세가 parent로 큰 분류를 가리키므로(on delete cascade) 같이 지운다
delete from public.topics where id in (select id from k_topics);
drop table k_topics;

-- 2-1) 분야 전체를 고른 사람의 그 분야 상세 관심사는 지운다(설정에서 분야 전체를 고르면 상세가 빠지는 것과 같게)
delete from public.user_topics u using public.topics t
where t.id = u.topic_id and t.parent is not null
  and exists (select 1 from public.user_topics g where g.user_id = u.user_id and g.topic_id = t.parent);

-- 3) K-Pop·K-뷰티·K-푸드 출처(RSS 8곳 + 유튜브 35곳)는 그만 받는다(collect는 active인 출처만 읽는다)
update public.sources set active = false where url in (
  'https://www.soompi.com/feed',
  'https://www.yna.co.kr/rss/entertainment.xml',
  'https://www.hankyung.com/feed/entertainment',
  'https://www.jangup.com/rss/allArticle.xml',
  'https://www.thebk.co.kr/rss/allArticle.xml',
  'https://www.thinkfood.co.kr/rss/allArticle.xml',
  'https://www.foodnews.co.kr/rss/allArticle.xml',
  'https://www.foodbank.co.kr/rss/allArticle.xml',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC3IZKseVpdzPSBaWxBxundA',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCaO6TYtlC8U5ttz62hTrZgg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCtCiO5t2voB14CmZKTkIzPQ',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCEf_Bc-KVd7onSeifS3py9g',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCvwmF24IxoxOhmYOYHvDHXg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCweOkPb1wVVH0Q0Tlj4a5Pw',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCS_hnpJLQTvBkqALgapi_4g',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCEIi7zFR_wE23jFncVtd6-A',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCd7yIRGoYvi1DUKIGTYvwFg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCVEzR8VHu0JC5xlTr53cMwQ',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC1OG_VAvw6yQuvZ1c8y9cLg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCpSa5CzQedAxXFGfmeeFdIw',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCW67yGQxNNMnLqRHyaTjygA',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC9kmlDcqksaOnCkC_qzGacA',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCnxmUrGMtpQT844Yd_l7Zyg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCrlUlicedicJ5mlibqC62Eg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCTQGAYPtbnCEfW9IGx65kiw',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCd7icqUv7f8k2E6n4WOCIQg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCPP291gN79qI1QZY1znOscg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCxthUNFu-GWQZ0YE9AnIetg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCYfAankzCbhjIV4EsU4Vzdw',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCFdi3igjh6--YqjX17M1lhA',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC-X4BAoKxwGYIKrKfqk7yug',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCYsv-IHC-B-DiVMmJuqibcg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC8rSUAeRrATc2xGh-EMPOGw',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCBlIcpkzSdcmp5G0XS7UsZA',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCCuXPHou1JQfRKM40q5tG8w',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC9qWVhCE-zIChRJpfRPVqOg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCBMBPRnwRgl3aJZDEpTu65Q',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UC4BfinFCS1o6t1tAsl0RVWQ',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCi_Zqq2zOwXLBVWi6VlMPdA',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCj8Ig9hXDEgWbZZ8cavr4lg',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCt24PsusUxDWPCyflGQficw',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCkW3qWVwgkI7mL0eFPVOlPA',
  'https://www.youtube.com/feeds/videos.xml?channel_id=UCDejdFmuh4NDWVvakJVcpdA'
);

-- 4) 글 카테고리에 정치·사회·세계 추가(연예·뷰티·푸드는 이미 요약된 글과 생활/문화 소식에 남긴다)
alter table public.summaries drop constraint summaries_category_check;
alter table public.summaries add constraint summaries_category_check
  check (category in ('ai','tech','design','business','marketing','career','finance','crypto','politics','society','world','entertainment','beauty','food','realestate','science','travel','life','etc'));
