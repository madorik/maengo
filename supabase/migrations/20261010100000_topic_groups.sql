-- 토픽 사전 v1(packages/core/src/topics/dictionary.ts와 같다): 큰 분류 5개(백엔드·프론트엔드·AI·부동산·주식) + 상세 관심사.
-- 처음엔 큰 분류만 고르고, 상세 관심사는 설정에서 더한다. 상세 관심사로 태그된 소식은 큰 분류에도 태그한다.

alter table public.topics add column parent text references public.topics on delete cascade;

-- 부모(큰 분류)를 먼저 넣어야 해서 parent는 나중에 채운다
insert into public.topics (id, name, aliases, popularity)
select id, name, aliases, popularity from (values
  ('backend', '백엔드', array['서버', '서버 개발', 'API', '인프라', '클라우드', 'DevOps']::text[], 1),
  ('frontend', '프론트엔드', array['웹 개발', '자바스크립트', 'JavaScript', 'TypeScript', 'UI 개발']::text[], 2),
  ('ai', 'AI', array['인공지능', '생성형 AI', '머신러닝', 'ChatGPT', 'Gemini', 'Claude']::text[], 3),
  ('realestate', '부동산', array['아파트', '집값', '주택', '분양', '부동산 시장']::text[], 4),
  ('stock', '주식', array['증시', '코스피', '코스닥', '나스닥', '주식 투자', '종목']::text[], 5),
  ('backend-perf', '백엔드 성능', array['성능 튜닝', '레이턴시', '서버 성능', '캐시', '트래픽']::text[], 15),
  ('database', '데이터베이스', array['DB', 'SQL']::text[], 16),
  ('postgres', 'PostgreSQL', array['포스트그레스', 'postgres']::text[], 17),
  ('kubernetes', '쿠버네티스', array['k8s', 'kubernetes', '컨테이너', '도커']::text[], 18),
  ('observability', '관측성', array['모니터링', '트레이싱', 'observability', '로그']::text[], 19),
  ('security', '보안', array['공급망 보안', '취약점', '해킹']::text[], 20),
  ('data-eng', '데이터 엔지니어링', array['데이터 파이프라인', 'ETL']::text[], 21),
  ('react', 'React', array['리액트', '서버 컴포넌트', 'Next.js']::text[], 22),
  ('web-perf', '웹 성능', array['Core Web Vitals', '로딩 속도', '프론트엔드 성능', '렌더링']::text[], 23),
  ('design-system', '디자인 시스템', array['디자인 토큰', '컴포넌트 라이브러리', 'UI 디자인', '피그마']::text[], 24),
  ('mobile-app', '모바일 앱', array['iOS', 'Android', '앱 성능', '안드로이드']::text[], 25),
  ('llm-agent', 'LLM 에이전트', array['에이전트', 'agent', 'AI 에이전트', '멀티 에이전트']::text[], 26),
  ('rag', 'RAG', array['검색 증강', '벡터 검색']::text[], 27),
  ('llm-dev', 'LLM 개발', array['LLM', 'LLM API', '언어 모델', '파인튜닝']::text[], 28),
  ('prompt', '프롬프트 설계', array['프롬프트 엔지니어링', 'prompt']::text[], 29),
  ('ai-tools', 'AI 도구', array['AI 툴', '코딩 어시스턴트', 'AI 코딩', '코파일럿']::text[], 30),
  ('speech-ai', '음성 AI', array['TTS', 'STT', '음성 합성']::text[], 31),
  ('re-subscription', '청약·분양', array['청약', '분양가', '청약 경쟁률', '특별공급']::text[], 32),
  ('re-policy', '부동산 정책·세금', array['부동산 대책', '대출 규제', 'DSR', '종부세', '양도세', '취득세']::text[], 33),
  ('re-rent', '전월세', array['전세', '월세', '전세 사기', '임대차']::text[], 34),
  ('re-redevelop', '재건축·재개발', array['재건축', '재개발', '정비사업', '리모델링']::text[], 35),
  ('stock-kr', '국내 주식', array['코스피', '코스닥', '국내 증시', '삼성전자']::text[], 36),
  ('stock-us', '미국 주식', array['나스닥', 'S&P500', '뉴욕 증시', '미국 증시', '엔비디아']::text[], 37),
  ('etf', 'ETF·연금 투자', array['ETF', '연금저축', 'IRP', 'ISA', '배당']::text[], 38),
  ('ipo', '공모주', array['IPO', '상장', '수요예측']::text[], 39),
  ('macro', '금리·환율', array['기준금리', '환율', '금리', '연준', 'FOMC', '물가']::text[], 40)
) as v(id, name, aliases, popularity)
on conflict (id) do update set name = excluded.name, aliases = excluded.aliases, popularity = excluded.popularity, embedding = null;

update public.topics t set parent = v.parent from (values
  ('backend-perf', 'backend'),
  ('database', 'backend'),
  ('postgres', 'backend'),
  ('kubernetes', 'backend'),
  ('observability', 'backend'),
  ('security', 'backend'),
  ('data-eng', 'backend'),
  ('react', 'frontend'),
  ('web-perf', 'frontend'),
  ('design-system', 'frontend'),
  ('mobile-app', 'frontend'),
  ('llm-agent', 'ai'),
  ('rag', 'ai'),
  ('llm-dev', 'ai'),
  ('prompt', 'ai'),
  ('ai-tools', 'ai'),
  ('speech-ai', 'ai'),
  ('re-subscription', 'realestate'),
  ('re-policy', 'realestate'),
  ('re-rent', 'realestate'),
  ('re-redevelop', 'realestate'),
  ('stock-kr', 'stock'),
  ('stock-us', 'stock'),
  ('etf', 'stock'),
  ('ipo', 'stock'),
  ('macro', 'stock')
) as v(id, parent) where t.id = v.id;

-- 빠지는 토픽(개발 쪽 곁가지). 걸린 행을 정리하고 지운다
update public.feedback set topic_id = null where topic_id in ('product','growth','career','remote-work','tech-biz');
update public.feeds set topic_id = 'ai' where topic_id in ('product','growth','career','remote-work','tech-biz');
delete from public.cluster_why where topic_id in ('product','growth','career','remote-work','tech-biz');
delete from public.cluster_topics where topic_id in ('product','growth','career','remote-work','tech-biz');
delete from public.user_topics where topic_id in ('product','growth','career','remote-work','tech-biz');
delete from public.topics where id in ('product','growth','career','remote-work','tech-biz');

-- 토픽 벡터는 이름·별칭이 바뀌었으니 다음 tag 단계에서 다시 만든다
update public.topics set embedding = null;

-- 이미 요약된 소식에도 큰 분류 태그와 why를 채운다(관련도는 자식 중 가장 큰 값)
insert into public.cluster_topics (cluster_id, topic_id, relevance)
select ct.cluster_id, t.parent, max(ct.relevance)
from public.cluster_topics ct join public.topics t on t.id = ct.topic_id
where t.parent is not null
group by ct.cluster_id, t.parent
on conflict (cluster_id, topic_id) do update set relevance = greatest(public.cluster_topics.relevance, excluded.relevance);

insert into public.cluster_why (cluster_id, topic_id, tier, why)
select distinct on (cw.cluster_id, t.parent, cw.tier)
  cw.cluster_id, t.parent, cw.tier, g.name || '에 관심 있다면: ' || substr(cw.why, strpos(cw.why, ': ') + 2)
from public.cluster_why cw
join public.topics t on t.id = cw.topic_id
join public.topics g on g.id = t.parent
join public.cluster_topics ct on ct.cluster_id = cw.cluster_id and ct.topic_id = cw.topic_id
where t.parent is not null
order by cw.cluster_id, t.parent, cw.tier, ct.relevance desc
on conflict (cluster_id, topic_id, tier) do nothing;

-- 글 카테고리에 부동산 추가
alter table public.summaries drop constraint summaries_category_check;
alter table public.summaries add constraint summaries_category_check
  check (category in ('ai','tech','design','business','marketing','career','finance','realestate','science','travel','life','etc'));
