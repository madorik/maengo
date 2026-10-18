-- 새벽 만료 처리 전에 RevenueCat을 다시 본다(2026-10-18 점검). 스케줄러(pipeline/src/scheduler.ts daily)가 기한이 지난 Premium을
-- 내리기 전에 그 사람들을 RevenueCat에서 다시 읽어 갱신됐으면 새 기한으로 맞춘다(웹 syncBilling, 이유 renewal_check).
-- RevenueCat을 못 읽은 사람(p_skip)은 이번에는 내리지 않는다: 갱신 웹훅보다 배치가 먼저 돌아 결제한 사람이 Free가 되지 않게.
-- 하는 일은 그대로이고 인자만 늘었다(인자 없이 부르면 예전과 같다. pipeline/src/run-daily.ts)
drop function if exists public.expire_premium();
create function public.expire_premium(p_skip uuid[] default '{}') returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  perform set_config('maengo.plan_reason', 'expiry_batch', true);
  update public.profiles set plan = 'free', premium_until = null
  where plan = 'plus' and premium_until is not null and premium_until < now() and not (id = any(coalesce(p_skip, '{}')));
  get diagnostics v_n = row_count;
  perform set_config('maengo.plan_reason', '', true);
  return v_n;
end;
$$;
revoke execute on function public.expire_premium(uuid[]) from public, anon, authenticated;
