-- 직접 입력한 관심사. 사전에 없는 말은 새 토픽(custom)으로 만들고, 같은 말이면 사용자끼리 같은 토픽을 쓴다(id = 'c-' + 내용 해시).
-- 배치는 누군가 고른 custom 토픽도 태그·요약 사전에 넣는다.
alter table public.topics add column custom boolean not null default false;
create index topics_custom_idx on public.topics (custom) where custom;

-- 큰 분류 순서: AI를 맨 위로
update public.topics set popularity = case id when 'ai' then 1 when 'backend' then 2 when 'frontend' then 3 when 'realestate' then 4 when 'stock' then 5 end
where id in ('ai','backend','frontend','realestate','stock');
