-- 관리자 탭 나누기(2026-10-22, /admin). 날짜는 한국 시간.
-- 1. 접속 기록(visits)에 플랫폼(web·ios·android). 앱은 User-Agent의 "MaengoApp/<버전> (ios|android)"로 가른다(apps/web/lib/server/visits.ts).
--    한 사람이 하루에 웹과 앱을 둘 다 열면 두 줄. 그 전 기록은 'unknown'.
-- 2. admin_stats 하나로 모든 숫자를 한 번에 세던 것을 탭마다 나눈다: 가입·활동(admin_stats_growth), 매출·콘텐츠(admin_stats_revenue), 운영(admin_stats_ops).
--    화면은 연 탭의 함수만 부른다. 숫자의 뜻은 20261020100000_admin_stats_funnel.sql과 같다.

-- 1. 접속 기록 플랫폼
alter table public.visits add column if not exists platform text not null default 'unknown';
alter table public.visits alter column platform drop default;
alter table public.visits drop constraint if exists visits_platform_check;
alter table public.visits add constraint visits_platform_check check (platform in ('web', 'ios', 'android', 'unknown'));
alter table public.visits drop constraint if exists visits_pkey;
alter table public.visits add primary key (user_id, date, platform);

-- 2-1. 가입·온보딩·활동. 플랫폼별 DAU는 그날 앱을 연 기록(visits)만으로 센다(읽음·들음에는 플랫폼이 없다)
create or replace function public.admin_stats_growth(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with
  b as (
    select (now() at time zone 'Asia/Seoul')::date as today,
           p_from::timestamp at time zone 'Asia/Seoul' as t_from,
           (p_to + 1)::timestamp at time zone 'Asia/Seoul' as t_to,
           (p_from - 29)::timestamp at time zone 'Asia/Seoul' as t_back
  ),
  days as (
    select g::date as d from generate_series(p_from, p_to, interval '1 day') g
  ),
  acts as (
    -- 활동한 (사람, 날짜). MAU를 첫날부터 세려고 p_from 29일 전부터 모은다
    select user_id, (read_at at time zone 'Asia/Seoul')::date as d from public.reads, b where read_at >= b.t_back and read_at < b.t_to
    union
    select user_id, (listened_at at time zone 'Asia/Seoul')::date from public.reads, b where listened_at >= b.t_back and listened_at < b.t_to
    union
    select user_id, date from public.visits where date between p_from - 29 and p_to
  ),
  signups as (
    select (created_at at time zone 'Asia/Seoul')::date as d, count(*) n from public.profiles, b
    where created_at >= b.t_from and created_at < b.t_to group by 1
  ),
  onboards as (
    select (onboarded_at at time zone 'Asia/Seoul')::date as d, count(*) n from public.profiles, b
    where onboarded_at >= b.t_from and onboarded_at < b.t_to group by 1
  ),
  reads_d as (
    select (read_at at time zone 'Asia/Seoul')::date as d, count(*) n from public.reads, b
    where read_at >= b.t_from and read_at < b.t_to group by 1
  ),
  listens_d as (
    select (listened_at at time zone 'Asia/Seoul')::date as d, count(*) n from public.reads, b
    where listened_at >= b.t_from and listened_at < b.t_to group by 1
  ),
  active_d as (
    select d, count(*) n from acts where d >= p_from group by d
  ),
  mau_d as (
    select days.d, (select count(distinct user_id) from acts where acts.d between days.d - 29 and days.d) n from days
  ),
  platform_d as (
    select date as d,
      count(*) filter (where platform = 'web') web,
      count(*) filter (where platform = 'ios') ios,
      count(*) filter (where platform = 'android') android
    from public.visits where date between p_from and p_to group by date
  ),
  -- 기간에 가입한 사람(퍼널·재방문의 모수)과 그 사람들이 활동한 날(오늘까지)
  coh as (
    select p.id, (p.created_at at time zone 'Asia/Seoul')::date as sd, p.created_at, p.onboarded_at from public.profiles p, b
    where p.created_at >= b.t_from and p.created_at < b.t_to
  ),
  coh_acts as (
    select r.user_id, (r.read_at at time zone 'Asia/Seoul')::date as d from public.reads r join coh on coh.id = r.user_id where r.read_at is not null
    union
    select r.user_id, (r.listened_at at time zone 'Asia/Seoul')::date from public.reads r join coh on coh.id = r.user_id where r.listened_at is not null
    union
    select v.user_id, v.date from public.visits v join coh on coh.id = v.user_id
  ),
  -- 실제 결제(테스트·운영자 권한·체험 빼고)
  paid as (
    select * from public.purchases
    where not sandbox and store in ('app_store', 'mac_app_store', 'play_store') and coalesce(period_type, 'normal') <> 'trial'
  ),
  steps as (
    select coh.*,
      coh.onboarded_at is not null as onboarded,
      exists (select 1 from public.feed_days f where f.user_id = coh.id and f.visible > 0) as fed,
      exists (select 1 from public.reads r where r.user_id = coh.id and (r.read_at is not null or r.listened_at is not null)) as engaged,
      exists (select 1 from coh_acts a where a.user_id = coh.id and a.d > coh.sd) as returned,
      exists (select 1 from paid where paid.user_id = coh.id and paid.refunded_at is null) as paid
    from coh
  ),
  ret as (
    select date_trunc('week', s.sd::timestamp)::date as wk,
      count(*) n,
      count(*) filter (where s.sd + 1 < b.today) d1_base,
      count(*) filter (where s.sd + 1 < b.today and exists (select 1 from coh_acts a where a.user_id = s.id and a.d = s.sd + 1)) d1,
      count(*) filter (where s.sd + 7 < b.today) d7_base,
      count(*) filter (where s.sd + 7 < b.today and exists (select 1 from coh_acts a where a.user_id = s.id and a.d = s.sd + 7)) d7,
      count(*) filter (where s.sd + 30 < b.today) d30_base,
      count(*) filter (where s.sd + 30 < b.today and exists (select 1 from coh_acts a where a.user_id = s.id and a.d = s.sd + 30)) d30
    from coh s, b group by 1
  )
  select jsonb_build_object(
    'today', (select today from b),
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'onboarded', (select count(*) from public.profiles where onboarded_at is not null),
      'signups', (select coalesce(sum(n), 0) from signups),
      'onboardedInRange', (select coalesce(sum(n), 0) from onboards),
      'cohortOnboarded', (select count(*) from coh where onboarded_at is not null),
      'onboardMedianMin', (select percentile_cont(0.5) within group (order by extract(epoch from onboarded_at - created_at) / 60) from coh where onboarded_at is not null),
      'pending', (select count(*) from public.profiles where onboarded_at is null),
      'pushOn', (select count(*) from public.profiles where push_enabled)
    ),
    'activity', jsonb_build_object(
      'active', (select count(distinct user_id) from acts where d >= p_from),
      'dau', (select count(*) from acts where d = p_to),
      'mau', (select count(distinct user_id) from acts where d between p_to - 29 and p_to),
      'reads', (select coalesce(sum(n), 0) from reads_d),
      'listens', (select coalesce(sum(n), 0) from listens_d),
      'fed', (select count(distinct user_id) from public.feed_days where date between p_from and p_to),
      'pushSent', (select count(*) from public.delivery_jobs where date between p_from and p_to and status = 'sent')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', days.d,
        'signups', coalesce(s.n, 0),
        'onboarded', coalesce(o.n, 0),
        'active', coalesce(a.n, 0),
        'mau', m.n,
        'reads', coalesce(r.n, 0),
        'listens', coalesce(l.n, 0),
        'web', coalesce(pf.web, 0),
        'ios', coalesce(pf.ios, 0),
        'android', coalesce(pf.android, 0)
      ) order by days.d), '[]')
      from days
      left join signups s on s.d = days.d
      left join onboards o on o.d = days.d
      left join active_d a on a.d = days.d
      join mau_d m on m.d = days.d
      left join reads_d r on r.d = days.d
      left join listens_d l on l.d = days.d
      left join platform_d pf on pf.d = days.d
    ),
    'funnel', jsonb_build_object(
      'signups', (select count(*) from steps),
      'onboarded', (select count(*) from steps where onboarded),
      'fed', (select count(*) from steps where onboarded and fed),
      'engaged', (select count(*) from steps where onboarded and fed and engaged),
      'returned', (select count(*) from steps where onboarded and fed and engaged and returned),
      'paid', (select count(*) from steps where paid)
    ),
    'retention', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week', wk, 'users', n,
        'd1', d1, 'd1Base', d1_base, 'd7', d7, 'd7Base', d7_base, 'd30', d30, 'd30Base', d30_base
      ) order by wk desc), '[]')
      from ret
    ),
    'features', jsonb_build_object(
      'readers', (select count(distinct user_id) from public.reads, b where read_at >= b.t_from and read_at < b.t_to),
      'listeners', (select count(distinct user_id) from public.reads, b where listened_at >= b.t_from and listened_at < b.t_to),
      'playlist', (select count(distinct user_id) from public.playlist_items),
      'links', (select count(distinct user_id) from public.user_topics where topic_id like 's-%' and weight > 0)
    )
  );
$$;

-- 2-2. 매출·결제·맹고 지갑·콘텐츠·비용. 결제는 실제 스토어(app_store·play_store)의 테스트가 아닌 거래만
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
      'ttsMonthChars', (select coalesce(sum(units), 0) from public.usage_log, b where provider = 'google' and kind = 'tts' and at >= b.month_start),
      'voices', (select count(*) from public.usage_log, b where provider = 'maengo' and kind = 'voice' and at >= b.t_from and at < b.t_to)
    )
  );
$$;

-- 2-3. 운영: 스케줄러 작업(지금), 기간의 알림 결과, 알림 기기(지금)
create or replace function public.admin_stats_ops(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'tasks', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'enabled', enabled, 'everyMinutes', every_minutes, 'nextRunAt', next_run_at,
        'runningSince', running_since, 'lastFinishedAt', last_finished_at, 'lastStatus', last_status, 'lastError', left(last_error, 200)) order by name), '[]')
      from public.scheduler_tasks
    ),
    'deliveries', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.delivery_jobs where date between p_from and p_to group by status) x),
    'devices', (select coalesce(jsonb_object_agg(platform, n), '{}') from (select platform, count(*) n from public.device_tokens group by platform) x)
  );
$$;

revoke all on function public.admin_stats_growth(date, date) from public, anon, authenticated;
revoke all on function public.admin_stats_revenue(date, date) from public, anon, authenticated;
revoke all on function public.admin_stats_ops(date, date) from public, anon, authenticated;
grant execute on function public.admin_stats_growth(date, date) to service_role;
grant execute on function public.admin_stats_revenue(date, date) to service_role;
grant execute on function public.admin_stats_ops(date, date) to service_role;

-- 예전 한 번에 세던 함수는 쓰지 않는다
drop function if exists public.admin_stats(date, date);
