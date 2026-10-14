-- 베타 종료(2026-10-14). 새로 가입하면 Free, 베타로 받은 기한 없는 Premium(premium_until 없음)은 Free로 돌린다(약관 6조의 약속).
-- Premium은 앱 안 결제(RevenueCat)로만 다시 얻는다(apps/web/lib/server/billing.ts가 plan·premium_until을 맞춘다).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, plan, premium_until)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), 'free', null);
  return new;
end;
$$;

update public.profiles set plan = 'free' where plan = 'plus' and premium_until is null;
