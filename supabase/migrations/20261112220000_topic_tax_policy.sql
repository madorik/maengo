-- 세금·정책 상세 관심사(2026-11-12 사용자: 정치는 온보딩에서 빼되 법안·예산처럼 돈에 닿는 정책은 받는다).
-- packages/core/src/topics/dictionary.ts와 같다. 큰 분류 없이 경제 분야(sections.ts GROUP_SECTION). 벡터는 파이프라인 tag 단계가 만든다
insert into public.topics (id, name, aliases, popularity)
values ('tax-policy', '세금·정책', array['세법·세제 개편', '금투세', '종부세', '양도세', '상속세·증여세', '예산안', '정부 지원금', '청년 지원 정책', '대출 규제(DSR)', '주택 규제', '금융 규제', '연금 개혁']::text[], 12)
on conflict (id) do update set name = excluded.name, aliases = excluded.aliases, popularity = excluded.popularity, parent = null, custom = false, embedding = null;
