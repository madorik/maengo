-- 관심 분야 v2(2026-10-10): 주기적으로 새 소식·데이터가 생기는 분야 8개로 바꾼다.
-- AI · 주식 · 코인 · 반도체·로봇 · 개발 · K-Pop · K-뷰티 · K-푸드. 백엔드·프론트엔드는 개발 하나로 합치고, 부동산은 뺀다.
-- packages/core/src/topics/dictionary.ts와 같다(아래 insert는 사전에서 뽑았다). 이름·별칭이 바뀌어 토픽 벡터는 다시 만든다(embedding = null).

-- 1) 새 사전. 부모를 먼저 바로잡아야 옛 큰 분류를 지울 때 남길 상세(보안 등)가 같이 지워지지 않는다(parent on delete cascade)
insert into public.topics (id, name, aliases, popularity)
select id, name, aliases, popularity from (values
  ('ai', 'AI', array['인공지능', '생성형 AI', '머신러닝', 'ChatGPT', 'Gemini', 'Claude']::text[], 1),
  ('stock', '주식', array['증시', '주식 투자', '종목', '주가', '증권']::text[], 2),
  ('coin', '코인', array['암호화폐', '가상자산', '가상화폐', '크립토', '블록체인']::text[], 3),
  ('chip-robot', '반도체·로봇', array['반도체 산업', '로봇 산업', '첨단 산업', '하드웨어']::text[], 4),
  ('dev', '개발', array['소프트웨어 개발', '프로그래밍', '개발자', '백엔드', '프론트엔드', 'DevOps']::text[], 5),
  ('kpop', 'K-Pop', array['케이팝', 'KPOP', '아이돌', '가요']::text[], 6),
  ('kbeauty', 'K-뷰티', array['K뷰티', '케이뷰티', '화장품', '뷰티', '코스메틱']::text[], 7),
  ('kfood', 'K-푸드', array['K푸드', '케이푸드', '식품', '먹거리']::text[], 8),
  ('llm-dev', 'LLM', array['새 모델', '언어 모델', '거대 언어 모델', '오픈소스 모델', 'LLM API']::text[], 11),
  ('vibe-coding', '바이브코딩', array['바이브 코딩', 'vibe coding', 'AI 코딩', '코딩 에이전트', 'Claude Code', 'Cursor', 'Copilot', '코파일럿']::text[], 12),
  ('llm-agent', 'AI 에이전트', array['에이전트', 'agent', 'LLM 에이전트', '멀티 에이전트', 'MCP']::text[], 13),
  ('ai-automation', '업무 자동화', array['자동화', '워크플로 자동화', '노코드', 'n8n', 'RPA', 'AI 업무']::text[], 14),
  ('rag', 'RAG', array['검색 증강', '벡터 검색', '벡터 DB']::text[], 15),
  ('gen-media', '이미지·영상 생성', array['이미지 생성', '영상 생성', '동영상 생성', 'Sora', 'Midjourney', '미드저니', 'Veo']::text[], 16),
  ('kospi', '코스피', array['KOSPI', '유가증권시장', '국내 증시']::text[], 17),
  ('kosdaq', '코스닥', array['KOSDAQ', '코스닥 시장']::text[], 18),
  ('stock-us', '미국 주식', array['나스닥', 'S&P500', '뉴욕 증시', '미국 증시', '다우']::text[], 19),
  ('macro', '금리·환율', array['기준금리', '환율', '금리', '연준', 'FOMC', '물가']::text[], 20),
  ('etf', 'ETF', array['상장지수펀드', '연금저축', 'IRP', 'ISA', '배당']::text[], 21),
  ('ipo', '공모주', array['IPO', '상장', '수요예측']::text[], 22),
  ('bitcoin', '비트코인', array['BTC', '비트코인 ETF', '비트코인 가격']::text[], 23),
  ('ethereum', '이더리움', array['ETH', '이더', '이더리움 ETF']::text[], 24),
  ('stablecoin', '스테이블코인', array['스테이블 코인', 'USDT', 'USDC', '테더', '원화 스테이블코인']::text[], 25),
  ('crypto-reg', '가상자산 규제', array['가상자산법', '코인 규제', '거래소 규제', '디지털자산기본법']::text[], 26),
  ('semiconductor', '반도체', array['HBM', '메모리 반도체', '파운드리', '엔비디아', 'TSMC', 'SK하이닉스', 'AI 칩', 'GPU']::text[], 27),
  ('robot', '로봇·휴머노이드', array['로봇', '휴머노이드', '피지컬 AI', '로보틱스', '산업용 로봇']::text[], 28),
  ('ev-battery', '전기차·배터리', array['전기차', '배터리', '2차전지', '이차전지', 'EV', '자율주행']::text[], 29),
  ('dev-release', '언어·프레임워크 릴리즈', array['릴리즈', '릴리스', '새 버전', 'Spring', '스프링', 'Spring Boot', '스프링 부트', 'FastAPI', 'Java', '자바', 'Kotlin', '코틀린', 'Python', '파이썬', 'React', '리액트', 'Next.js', 'Vue', 'TypeScript', '타입스크립트', 'PostgreSQL']::text[], 30),
  ('cloud', '클라우드', array['AWS', 'Azure', '애저', 'GCP', 'Google Cloud', '구글 클라우드', '쿠버네티스', 'Kubernetes', '서버리스']::text[], 31),
  ('security', '보안', array['해킹', '취약점', 'CVE', '개인정보 유출', '랜섬웨어', '공급망 보안']::text[], 32),
  ('kpop-release', '컴백·신곡', array['컴백', '신곡', '앨범', '뮤직비디오', '데뷔']::text[], 33),
  ('kpop-chart', '음원 차트', array['차트', '멜론 차트', '빌보드', '음원 순위', '음반 판매량']::text[], 34),
  ('kpop-concert', '콘서트·투어', array['콘서트', '월드투어', '투어', '팬미팅', '공연']::text[], 35),
  ('beauty-new', '화장품 신제품', array['뷰티 신제품', '신상 화장품', '스킨케어 신제품']::text[], 36),
  ('beauty-trend', '뷰티 랭킹·트렌드', array['올리브영', '뷰티 트렌드', '화장품 랭킹', '뷰티 랭킹']::text[], 37),
  ('beauty-export', '뷰티 브랜드·수출', array['화장품 수출', 'K뷰티 수출', '인디 브랜드', '아모레퍼시픽', 'LG생활건강']::text[], 38),
  ('food-new', '편의점·식품 신상', array['편의점 신상', '식품 신제품', '라면 신제품', '과자 신제품']::text[], 39),
  ('food-franchise', '외식·프랜차이즈', array['프랜차이즈', '외식', '배달', '카페', '치킨']::text[], 40),
  ('food-export', 'K-푸드 수출', array['식품 수출', '라면 수출', '불닭', '한식 세계화']::text[], 41)
) as v(id, name, aliases, popularity)
on conflict (id) do update set name = excluded.name, aliases = excluded.aliases, popularity = excluded.popularity, parent = null, custom = false, embedding = null;

update public.topics t set parent = v.parent from (values
  ('llm-dev', 'ai'),
  ('vibe-coding', 'ai'),
  ('llm-agent', 'ai'),
  ('ai-automation', 'ai'),
  ('rag', 'ai'),
  ('gen-media', 'ai'),
  ('kospi', 'stock'),
  ('kosdaq', 'stock'),
  ('stock-us', 'stock'),
  ('macro', 'stock'),
  ('etf', 'stock'),
  ('ipo', 'stock'),
  ('bitcoin', 'coin'),
  ('ethereum', 'coin'),
  ('stablecoin', 'coin'),
  ('crypto-reg', 'coin'),
  ('semiconductor', 'chip-robot'),
  ('robot', 'chip-robot'),
  ('ev-battery', 'chip-robot'),
  ('dev-release', 'dev'),
  ('cloud', 'dev'),
  ('security', 'dev'),
  ('kpop-release', 'kpop'),
  ('kpop-chart', 'kpop'),
  ('kpop-concert', 'kpop'),
  ('beauty-new', 'kbeauty'),
  ('beauty-trend', 'kbeauty'),
  ('beauty-export', 'kbeauty'),
  ('food-new', 'kfood'),
  ('food-franchise', 'kfood'),
  ('food-export', 'kfood')
) as v(id, parent) where t.id = v.id;

-- 2) 빠지는 토픽이 옮겨 갈 곳. 부동산(realestate, re-policy)은 옮길 곳 없이 지운다
create temporary table topic_moves (old text primary key, new text not null);
insert into topic_moves (old, new) values
  ('backend', 'dev'), ('frontend', 'dev'),
  ('spring', 'dev-release'), ('fastapi', 'dev-release'), ('java', 'dev-release'), ('kotlin', 'dev-release'), ('python', 'dev-release'),
  ('react', 'dev-release'), ('nextjs', 'dev-release'), ('vue', 'dev-release'), ('typescript', 'dev-release'), ('postgres', 'dev-release'),
  ('aws', 'cloud'), ('azure', 'cloud'), ('gcp', 'cloud'), ('kubernetes', 'cloud'),
  ('backend-perf', 'dev'), ('database', 'dev'), ('observability', 'dev'), ('data-eng', 'dev'),
  ('web-perf', 'dev'), ('design-system', 'dev'), ('mobile-app', 'dev'),
  ('fine-tuning', 'llm-dev'), ('prompt', 'llm-dev'), ('ai-tools', 'vibe-coding'), ('speech-ai', 'ai'),
  ('stock-kr', 'kospi');

-- 고른 관심사는 옮긴 곳으로 더한다
insert into public.user_topics (user_id, topic_id, weight, source)
select distinct u.user_id, m.new, 1, 'settings' from public.user_topics u join topic_moves m on m.old = u.topic_id
on conflict (user_id, topic_id) do nothing;

-- 요약된 소식의 태그도 옮기고(관련도는 큰 값), 상세 태그에는 큰 분류 태그를 더한다(withParents와 같다)
insert into public.cluster_topics (cluster_id, topic_id, relevance)
select ct.cluster_id, m.new, max(ct.relevance) from public.cluster_topics ct join topic_moves m on m.old = ct.topic_id
group by ct.cluster_id, m.new
on conflict (cluster_id, topic_id) do update set relevance = greatest(public.cluster_topics.relevance, excluded.relevance);
insert into public.cluster_topics (cluster_id, topic_id, relevance)
select ct.cluster_id, t.parent, max(ct.relevance) from public.cluster_topics ct join public.topics t on t.id = ct.topic_id
where t.parent is not null
group by ct.cluster_id, t.parent
on conflict (cluster_id, topic_id) do update set relevance = greatest(public.cluster_topics.relevance, excluded.relevance);

update public.feeds f set topic_id = m.new from topic_moves m where f.topic_id = m.old;
update public.feedback f set topic_id = m.new from topic_moves m where f.topic_id = m.old;
delete from public.feeds where topic_id in ('realestate', 're-policy');
update public.feedback set topic_id = null where topic_id in ('realestate', 're-policy');

-- why 문구는 옛 이름으로 쓰였으니 지운다(새 토픽 why는 다음 요약부터)
delete from public.cluster_why where topic_id in (select old from topic_moves) or topic_id in ('realestate', 're-policy');
delete from public.cluster_topics where topic_id in (select old from topic_moves) or topic_id in ('realestate', 're-policy');
delete from public.user_topics where topic_id in (select old from topic_moves) or topic_id in ('realestate', 're-policy');
delete from public.topics where id in (select old from topic_moves) or id in ('realestate', 're-policy');
drop table topic_moves;

-- 3) 부동산 출처는 그만 받는다(collect는 active인 출처만 읽는다)
update public.sources set active = false
where url in ('https://www.hankyung.com/feed/realestate', 'https://www.mk.co.kr/rss/50300009/', 'http://rss.edaily.co.kr/realestate_news.xml');

-- 4) 글 카테고리에 코인·연예·뷰티·푸드 추가(부동산은 이미 요약된 글에 남아 둔다)
alter table public.summaries drop constraint summaries_category_check;
alter table public.summaries add constraint summaries_category_check
  check (category in ('ai','tech','design','business','marketing','career','finance','crypto','entertainment','beauty','food','realestate','science','travel','life','etc'));
