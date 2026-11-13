-- 관리자 API 지출에 OpenAI 더하기(2026-11-14). 오늘의 흐름·맞춤 체크·맹고 AI 답·추천 질문을 OpenAI gpt-6-luna로 만들며(apps/web/lib/server/openai.ts)
-- usage_log에 provider 'openai'로 남긴다. 예전 함수는 provider 'gemini'만 셌다.
-- 1. admin_stats_revenue: cost에 openaiUsd(기간)·openaiMonthUsd(이번 달)를 더한다(Gemini 줄은 그대로). 본문은 20261022100000_admin_tabs.sql과 같고 그 두 줄만 다르다.
-- 2. admin_stats_summary: 날마다 API 비용(gem_d)에 OpenAI도 센다. 본문은 20261108120000_admin_summary.sql과 같고 gem_d만 다르다.
-- create or replace라 권한(service_role만 실행)은 그대로다.

create or replace function public.admin_stats_revenue(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with
  b as (
    select p_from::timestamp at time zone 'Asia/Seoul' as t_from,
           (p_to + 1)::timestamp at time zone 'Asia/Seoul' as t_to,
           (date_trunc('month', now() at time zone 'Asia/Seoul'))::timestamp at time zone 'Asia/Seoul' as month_start
  ),
  pay as (
    select * from public.purchases where not sandbox and store in ('app_store', 'mac_app_store', 'play_store')
  ),
  paid as (
    select * from pay where coalesce(period_type, 'normal') <> 'trial'
  ),
  paid_r as (
    select paid.* from paid, b where purchased_at >= b.t_from and purchased_at < b.t_to
  ),
  coh as (
    select p.id from public.profiles p, b where p.created_at >= b.t_from and p.created_at < b.t_to
  ),
  -- 체험: 사람마다 첫 체험 거래. 체험이 끝난(만료가 지난) 사람 중 그 뒤 구독 결제가 있으면 전환
  trials as (
    select user_id, min(purchased_at) as at, max(expires_at) as ends from pay
    where kind = 'subscription' and period_type = 'trial' group by user_id
  ),
  trials_r as (
    select t.*, t.ends <= now() as ended,
      exists (select 1 from paid where paid.user_id = t.user_id and paid.kind = 'subscription' and paid.purchased_at >= t.at) as converted
    from trials t, b where t.at >= b.t_from and t.at < b.t_to
  ),
  -- 지갑 기록(테스트 결제로 들어오고 나간 맹고는 뺀다)
  wl as (
    select l.* from public.wallet_ledger l, b
    where l.at >= b.t_from and l.at < b.t_to
      and not (l.reason in ('purchase', 'chargeback') and exists (
        select 1 from public.purchases p
        where (p.sandbox or p.store not in ('app_store', 'mac_app_store', 'play_store'))
          and (l.ref = 'rc:' || p.rc_id or l.store_tx = p.store || ':' || p.transaction_id)))
  )
  select jsonb_build_object(
    'revenue', jsonb_build_object(
      'krw', (select coalesce(sum(price), 0) from paid_r where refunded_at is null and currency = 'KRW'),
      'usd', (select coalesce(sum(price_usd), 0) from paid_r where refunded_at is null and currency is distinct from 'KRW'),
      'unpriced', (select count(*) from paid_r where refunded_at is null and price is null and price_usd is null),
      'payers', (select count(distinct user_id) from paid_r where refunded_at is null),
      'subscriptions', (select count(*) from paid_r where kind = 'subscription'),
      'packs', (select count(*) from paid_r where kind = 'pack'),
      'packMaengo', (select coalesce(sum(substring(product_id from 'maengo_pack_(\d+)')::int), 0) from paid_r where kind = 'pack'),
      'refunds', (select count(*) from pay, b where refunded_at >= b.t_from and refunded_at < b.t_to),
      'trials', (select count(*) from trials_r),
      'trialsEnded', (select count(*) from trials_r where ended),
      'trialsConverted', (select count(*) from trials_r where ended and converted),
      'premium', (select count(*) from public.profiles where plan = 'plus'),
      'subs', (
        select coalesce(jsonb_object_agg(status, n), '{}')
        from (select s.status, count(*) n from public.subscriptions s join public.profiles p on p.id = s.user_id
              where p.plan = 'plus' and s.store in ('app_store', 'play') group by s.status) x
      ),
      'cancelAtEnd', (
        select count(*) from public.subscriptions s join public.profiles p on p.id = s.user_id
        where p.plan = 'plus' and s.store in ('app_store', 'play') and s.cancel_at_period_end
      ),
      'cohortSignups', (select count(*) from coh),
      'cohortPaid', (select count(*) from coh where exists (select 1 from paid where paid.user_id = coh.id and paid.refunded_at is null))
    ),
    'wallet', jsonb_build_object(
      'used', (select coalesce(-sum(delta), 0) from wl where reason in ('more', 'refund')),
      'users', (select count(distinct user_id) from wl where reason = 'more'),
      'bought', (select coalesce(sum(delta), 0) from wl where reason = 'purchase'),
      'gifted', (select coalesce(sum(delta), 0) from wl where reason = 'signup'),
      'clawback', (select coalesce(-sum(delta), 0) from wl where reason = 'chargeback'),
      'balance', (select coalesce(sum(balance), 0) from public.wallets)
    ),
    'feedback', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from public.feedback, b where created_at >= b.t_from and created_at < b.t_to group by kind) x),
    'feedbackAll', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from public.feedback group by kind) x),
    'content', jsonb_build_object(
      'items', (select count(*) from public.items, b where fetched_at >= b.t_from and fetched_at < b.t_to),
      'summaries', (select count(*) from public.summaries, b where created_at >= b.t_from and created_at < b.t_to),
      'summariesTotal', (select count(*) from public.summaries),
      'topics', (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'custom', custom, 'users', n) order by n desc, name), '[]')
        from (
          select t.id, t.name, t.custom, count(*) n
          from public.user_topics u join public.topics t on t.id = u.topic_id
          where u.weight > 0 and u.topic_id not like 's-%' group by t.id, t.name, t.custom order by n desc limit 30
        ) x
      )
    ),
    'cost', jsonb_build_object(
      'geminiUsd', (select coalesce(sum(est_usd), 0) from public.usage_log, b where provider = 'gemini' and at >= b.t_from and at < b.t_to),
      'geminiMonthUsd', (select coalesce(sum(est_usd), 0) from public.usage_log, b where provider = 'gemini' and at >= b.month_start),
      'openaiUsd', (select coalesce(sum(est_usd), 0) from public.usage_log, b where provider = 'openai' and at >= b.t_from and at < b.t_to),
      'openaiMonthUsd', (select coalesce(sum(est_usd), 0) from public.usage_log, b where provider = 'openai' and at >= b.month_start),
      'ttsMonthChars', (select coalesce(sum(units), 0) from public.usage_log, b where provider = 'google' and kind = 'tts' and at >= b.month_start),
      'voices', (select count(*) from public.usage_log, b where provider = 'maengo' and kind = 'voice' and at >= b.t_from and at < b.t_to)
    )
  );
$$;


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
  -- API 비용: Gemini(요약·임베딩·음성 …)·OpenAI(오늘의 흐름·맹고 AI, 2026-11-14부터)는 기록한 추정값, Google TTS(Chirp)는 매달 100만 자 무료를 넘은 글자만 100만 자당 $30
  gem_d as (
    select (at at time zone 'Asia/Seoul')::date as d, sum(est_usd) as usd from public.usage_log where provider in ('gemini', 'openai') group by 1
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
