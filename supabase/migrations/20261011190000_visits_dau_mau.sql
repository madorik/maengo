-- DAU·MAU(2026-10-11, /admin). 활동 = 그날 앱을 열었거나(visits) 읽었거나 들은 사람. 날짜는 한국 시간.
-- visits는 로그인한 화면을 처음 그릴 때 하루 한 번 쌓는다(apps/web/lib/server/visits.ts). 그 전 날짜는 읽음·들음만으로 센다.
create table public.visits (
  user_id  uuid not null references public.profiles on delete cascade,
  date     date not null,   -- 한국 날짜
  primary key (user_id, date)
);
create index visits_date_idx on public.visits (date);
alter table public.visits enable row level security;

-- 관리자 통계: 기간(p_from~p_to) 숫자 + DAU(마지막 날)·MAU(마지막 날까지 30일)·날마다 DAU·MAU.
create or replace function public.admin_stats(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with
  b as (
    select (now() at time zone 'Asia/Seoul')::date as today,
           p_from::timestamp at time zone 'Asia/Seoul' as t_from,
           (p_to + 1)::timestamp at time zone 'Asia/Seoul' as t_to,
           (p_from - 29)::timestamp at time zone 'Asia/Seoul' as t_back,
           (date_trunc('month', now() at time zone 'Asia/Seoul'))::timestamp at time zone 'Asia/Seoul' as month_start
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
  )
  select jsonb_build_object(
    'today', (select today from b),
    'from', p_from,
    'to', p_to,
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'onboarded', (select count(*) from public.profiles where onboarded_at is not null),
      'signups', (select coalesce(sum(n), 0) from signups),
      'pushOn', (select count(*) from public.profiles where push_enabled),
      'plans', (select coalesce(jsonb_object_agg(plan, n), '{}') from (select plan, count(*) n from public.profiles group by plan) x)
    ),
    'activity', jsonb_build_object(
      'active', (select count(distinct user_id) from acts where d >= p_from),
      'dau', (select count(*) from acts where d = p_to),
      'mau', (select count(distinct user_id) from acts where d between p_to - 29 and p_to),
      'reads', (select coalesce(sum(n), 0) from reads_d),
      'listens', (select coalesce(sum(n), 0) from listens_d),
      'fed', (select count(distinct user_id) from public.feed_days where date between p_from and p_to),
      'feedback', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from public.feedback, b where created_at >= b.t_from and created_at < b.t_to group by kind) x),
      'feedbackAll', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from public.feedback group by kind) x)
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', days.d,
        'signups', coalesce(s.n, 0),
        'active', coalesce(a.n, 0),
        'mau', m.n,
        'reads', coalesce(r.n, 0),
        'listens', coalesce(l.n, 0)
      ) order by days.d), '[]')
      from days
      left join signups s on s.d = days.d
      left join active_d a on a.d = days.d
      join mau_d m on m.d = days.d
      left join reads_d r on r.d = days.d
      left join listens_d l on l.d = days.d
    ),
    'content', jsonb_build_object(
      'items', (select count(*) from public.items, b where fetched_at >= b.t_from and fetched_at < b.t_to),
      'summaries', (select count(*) from public.summaries, b where created_at >= b.t_from and created_at < b.t_to),
      'summariesTotal', (select count(*) from public.summaries),
      'topics', (
        select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'custom', custom, 'users', n) order by n desc, name), '[]')
        from (
          select t.id, t.name, t.custom, count(*) n
          from public.user_topics u join public.topics t on t.id = u.topic_id
          where u.weight > 0 group by t.id, t.name, t.custom order by n desc limit 30
        ) x
      )
    ),
    'cost', jsonb_build_object(
      'geminiUsd', (select coalesce(sum(est_usd), 0) from public.usage_log, b where provider = 'gemini' and at >= b.t_from and at < b.t_to),
      'geminiMonthUsd', (select coalesce(sum(est_usd), 0) from public.usage_log, b where provider = 'gemini' and at >= b.month_start),
      'ttsMonthChars', (select coalesce(sum(units), 0) from public.usage_log, b where provider = 'google' and kind = 'tts' and at >= b.month_start),
      'ttsMonthUsd', (select coalesce(sum(est_usd), 0) from public.usage_log, b where provider = 'google' and kind = 'tts' and at >= b.month_start),
      'voices', (select count(*) from public.usage_log, b where provider = 'maengo' and kind = 'voice' and at >= b.t_from and at < b.t_to)
    ),
    'ops', jsonb_build_object(
      'tasks', (
        select coalesce(jsonb_agg(jsonb_build_object('name', name, 'enabled', enabled, 'everyMinutes', every_minutes, 'nextRunAt', next_run_at,
          'runningSince', running_since, 'lastFinishedAt', last_finished_at, 'lastStatus', last_status, 'lastError', left(last_error, 200)) order by name), '[]')
        from public.scheduler_tasks
      ),
      'deliveries', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.delivery_jobs where date between p_from and p_to group by status) x),
      'devices', (select coalesce(jsonb_object_agg(platform, n), '{}') from (select platform, count(*) n from public.device_tokens group by platform) x)
    )
  );
$$;

revoke all on function public.admin_stats(date, date) from public, anon, authenticated;
grant execute on function public.admin_stats(date, date) to service_role;
