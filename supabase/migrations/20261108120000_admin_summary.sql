-- 관리자 요약 탭(2026-11-08, /admin 첫 탭). 날짜는 한국 시간.
-- 1. 로그인 안 한 방문자(guest_visits): 가입 전환율(가입 ÷ 방문자)의 분모. 웹 소개·로그인·둘러보기·분야 페이지와 앱의 로그인 화면을 연 사람을
--    하루 한 줄로 센다(apps/web/app/api/visit/route.ts). visitor는 기기가 그날만 쓰는 무작위 값(저장소가 막혔으면 IP·User-Agent)을 날짜·비밀값과
--    함께 바꾼 값이라 원래 값은 남지 않고, 날이 바뀌면 같은 사람도 다른 값이 된다(여러 날의 방문자는 날마다 센 수의 합).
-- 2. admin_stats_summary(p_from, p_to): 날마다 방문자·가입·새 구독자·체험 시작·유료 구독자(그날 끝)·매출·API 비용과 p_from 전까지의 누적.
--    누적(전체 회원·전체 매출·누적 지출)은 화면이 base에 날마다 값을 더해 그린다(apps/web/lib/admin-stats.ts summarySeries).
--    결제는 실제 스토어(app_store·play_store)의 테스트가 아닌 거래만, 체험은 매출·구독자에서 뺀다(20261022100000_admin_tabs.sql과 같은 규칙).

create table if not exists public.guest_visits (
  date     date not null,   -- 한국 날짜
  visitor  text not null,   -- 그날의 방문자 값을 바꾼 것(32자)
  platform text not null check (platform in ('web', 'ios', 'android')),
  primary key (date, visitor)
);
alter table public.guest_visits enable row level security;

create or replace function public.admin_stats_summary(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with
  days as (
    select g::date as d from generate_series(p_from, p_to, interval '1 day') g
  ),
  pay as (
    select * from public.purchases where not sandbox and store in ('app_store', 'mac_app_store', 'play_store')
  ),
  paid as (
    select * from pay where coalesce(period_type, 'normal') <> 'trial'
  ),
  -- 날마다 매출(환불한 결제는 뺀다). 원화와 그 밖 통화(달러)를 따로, 화면이 환율로 더한다
  rev_d as (
    select (purchased_at at time zone 'Asia/Seoul')::date as d,
      coalesce(sum(price) filter (where currency = 'KRW'), 0) as krw,
      coalesce(sum(price_usd) filter (where currency is distinct from 'KRW'), 0) as usd
    from paid where refunded_at is null group by 1
  ),
  -- 새 구독자 = 사람마다 첫 유료 구독 결제일, 체험 시작 = 사람마다 첫 체험
  new_sub_d as (
    select d, count(*) as n from (
      select user_id, (min(purchased_at) at time zone 'Asia/Seoul')::date as d from paid
      where kind = 'subscription' and refunded_at is null group by user_id
    ) x group by d
  ),
  trial_d as (
    select d, count(*) as n from (
      select user_id, (min(purchased_at) at time zone 'Asia/Seoul')::date as d from pay
      where kind = 'subscription' and period_type = 'trial' group by user_id
    ) x group by d
  ),
  signup_d as (
    select (created_at at time zone 'Asia/Seoul')::date as d, count(*) as n from public.profiles group by 1
  ),
  -- API 비용: Gemini(요약·임베딩·음성·맹고 AI …)는 기록한 추정값, Google TTS(Chirp)는 매달 100만 자 무료를 넘은 글자만 100만 자당 $30
  gem_d as (
    select (at at time zone 'Asia/Seoul')::date as d, sum(est_usd) as usd from public.usage_log where provider = 'gemini' group by 1
  ),
  tts_d as (
    select (at at time zone 'Asia/Seoul')::date as d, sum(units) as chars from public.usage_log where provider = 'google' and kind = 'tts' group by 1
  ),
  tts_cost as (
    select d, (greatest(0, cum - 1000000) - greatest(0, cum - chars - 1000000)) * 30.0 / 1000000 as usd
    from (select d, chars, sum(chars) over (partition by date_trunc('month', d) order by d) as cum from tts_d) m
  ),
  cost_d as (
    select d, sum(usd) as usd from (select d, usd from gem_d union all select d, usd from tts_cost) c group by d
  ),
  visit_d as (
    select date as d, count(*) as n from public.guest_visits where date between p_from and p_to group by date
  )
  select jsonb_build_object(
    'firstVisit', (select min(date) from public.guest_visits),
    'base', jsonb_build_object(
      'users', (select count(*) from public.profiles where created_at < p_from::timestamp at time zone 'Asia/Seoul'),
      'krw', (select coalesce(sum(krw), 0) from rev_d where d < p_from),
      'usd', (select coalesce(sum(usd), 0) from rev_d where d < p_from),
      'costUsd', (select coalesce(sum(usd), 0) from cost_d where d < p_from)
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', days.d,
        'visitors', coalesce(v.n, 0),
        'signups', coalesce(s.n, 0),
        'newSubs', coalesce(ns.n, 0),
        'trials', coalesce(t.n, 0),
        -- 그날 끝(오늘은 지금)에 유료 구독 기간 안인 사람: 결제했고, 만료 전이고, 그때까지 환불하지 않음
        'subs', (
          select count(distinct p.user_id) from paid p,
            lateral (select least(now(), (days.d + 1)::timestamp at time zone 'Asia/Seoul') as t) e
          where p.kind = 'subscription' and p.purchased_at < e.t
            and coalesce(p.expires_at, p.purchased_at + interval '1 month') > e.t
            and (p.refunded_at is null or p.refunded_at > e.t)
        ),
        'krw', coalesce(r.krw, 0),
        'usd', coalesce(r.usd, 0),
        'costUsd', coalesce(c.usd, 0)
      ) order by days.d), '[]')
      from days
      left join visit_d v on v.d = days.d
      left join signup_d s on s.d = days.d
      left join new_sub_d ns on ns.d = days.d
      left join trial_d t on t.d = days.d
      left join rev_d r on r.d = days.d
      left join cost_d c on c.d = days.d
    )
  );
$$;

revoke all on function public.admin_stats_summary(date, date) from public, anon, authenticated;
grant execute on function public.admin_stats_summary(date, date) to service_role;
