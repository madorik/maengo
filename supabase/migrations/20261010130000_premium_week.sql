-- 플랜은 Free·Premium 둘뿐이다('trial' 없앰). 가입하면 1주일 동안 진짜 Premium(premium_until), 지나면 Free로 돌린다.
-- 결제가 붙으면 premium_until을 결제 기간 끝으로 둔다(정기결제는 갱신할 때마다 늘린다). null이면 기한 없음.
alter table public.profiles drop constraint profiles_plan_check;
update public.profiles set plan = 'plus' where plan = 'trial';
alter table public.profiles rename column trial_ends_at to premium_until;
alter table public.profiles alter column plan set default 'free';
alter table public.profiles add constraint profiles_plan_check check (plan in ('free','plus'));

-- 가입하면 프로필을 만든다: 1주일 Premium. 이름은 애플·구글이 처음 한 번만 준다
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, plan, premium_until)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), 'plus', now() + interval '7 days');
  return new;
end;
$$;

-- 기한이 지난 Premium을 Free로 돌린다. 일일 배치가 시작할 때 부르고, 웹은 그 사람 것만 그 자리에서 돌린다
create function public.expire_premium() returns int
language sql security definer set search_path = '' as $$
  with u as (
    update public.profiles set plan = 'free', premium_until = null
    where plan = 'plus' and premium_until is not null and premium_until < now()
    returning 1
  )
  select count(*)::int from u;
$$;
revoke execute on function public.expire_premium() from public, anon, authenticated;
