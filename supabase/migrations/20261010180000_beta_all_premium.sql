-- 베타(2026-10-10~): 결제를 받기 전까지 모든 회원이 기한 없는 Premium이다.
-- 정식 출시 때 이 트리거(가입 시 플랜)와 기존 회원의 플랜을 다시 정한다(apps/web/lib/site.ts의 BETA와 함께).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, plan, premium_until)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), 'plus', null);
  return new;
end;
$$;

-- 지금 회원도 모두 기한 없는 Premium으로(1주일 기한을 없앤다. expire_premium은 기한이 있는 사람만 돌린다)
update public.profiles set plan = 'plus', premium_until = null;
