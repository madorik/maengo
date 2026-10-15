-- 내 관심 링크(2026-10-15 사용자 결정): Premium이 블로그·사이트의 RSS 주소를 넣으면 그곳의 새 글을 소식으로 받는다. 유튜브는 받지 않는다.
-- 출처는 sources 표에 custom = true로 들어가고(같은 주소는 사용자끼리 한 행), 구독은 user_topics에 토픽 's-<sources.id>'로 둔다.
-- 그래서 랭킹·피드백·지급은 관심사와 같은 길을 탄다. 링크 글이 든 묶음에는 tag 단계(tagLinks)가 그 토픽을 관련도 1로 붙인다.
-- 넣은 사람만 받는다(D15): 구성원이 모두 custom 출처인 묶음에는 임베딩·AI 토픽을 붙이지 않는다. 구독자가 없어지면 active = false.
-- 하루 소식에서 링크 글은 절반까지(D19, core rankFeed의 maxLinks). 한 출처는 하루 2개까지(maxPerTopic).
alter table public.sources add column if not exists custom       boolean not null default false;
alter table public.sources add column if not exists site_url     text;         -- 사용자가 넣은 사이트 주소(설정 목록에서 여는 곳)
alter table public.sources add column if not exists last_item_at timestamptz;  -- 피드에서 본 가장 최근 글의 발행 시각(설정 목록의 '마지막 글')
create index if not exists sources_custom_idx on public.sources (custom) where custom;

-- 플랜별 링크 수(처음엔 Premium 10. 2026-10-15 사용자 결정으로 3개, …_link_slots.sql). plans 표라 배포 없이 바꾼다
alter table public.plans add column if not exists link_limit int not null default 0 check (link_limit >= 0);
update public.plans set link_limit = 10 where id = 'plus';
