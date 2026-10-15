-- 내 관심 링크 2차(2026-10-15 사용자 결정): 한 사람에 3개, 설정에서는 인풋박스 칸 3개로 관리한다(apps/web/components/settings/LinkSlots.tsx).
-- 칸 번호는 user_topics.slot(1부터). 링크 토픽('s-…') 행만 갖고 관심사 행은 null. 넣어 둔 칸에 다른 주소를 넣으면 그 칸의 링크가 바뀐다.
update public.plans set link_limit = 3 where id = 'plus';
alter table public.user_topics add column if not exists slot smallint check (slot is null or slot between 1 and 20);
