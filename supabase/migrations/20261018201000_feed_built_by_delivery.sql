-- 배송이 만든 오늘 피드를 따로 표시한다(2026-10-18 점검). feed_days.built_by에 'delivery'를 더한다.
-- 배송(pipeline/src/deliveries.ts)은 만들고 ready로 바꾸기 전에 멈추면, 다음 실행이 이미 있는 피드를 보고 '내가 만든 것이면 이어서 알린다'.
-- 전엔 'pipeline'(열 기본값)이면 배송이 만든 것으로 봤는데, 손으로 돌린 rank(jobs/rank.ts) 등 다른 곳도 이 기본값으로 넣어 구별이 안 됐다.
-- 이제 배송은 'delivery'로 넣고, 'pipeline'은 그 줄을 전에 가져간 적이 있을 때만 멈춘 배송으로 본다(lib/retry.ts existingFeedResult).
-- 적용 순서는 상관없다: 이 마이그레이션 전이면 배송이 'delivery'를 거절받고(23514) 열 기본값으로 다시 넣는다. 그래도 먼저 적용하는 게 좋다.
-- 여러 번 돌려도 같은 결과가 나오게 쓴다.

-- built_by 검사 제약(20261009170000에서 열과 함께 만든 것. 이름은 보통 feed_days_built_by_check)을 이름과 상관없이 지운다
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
     where con.conrelid = 'public.feed_days'::regclass
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%built_by%'
  loop
    execute format('alter table public.feed_days drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.feed_days add constraint feed_days_built_by_check check (built_by in ('pipeline', 'web', 'delivery'));
