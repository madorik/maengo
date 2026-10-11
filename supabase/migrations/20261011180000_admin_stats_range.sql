-- 관리자 통계 기간 검색(2026-10-11, /admin?from=…&to=…). p_from~p_to(한국 날짜, 양끝 포함) 동안의 숫자를 센다.
-- 회원 수·알림 켬·요금제·관심사·작업 상태·알림 기기·이번 달 비용은 기간과 상관없는 지금 값이다.
-- 서버(service role)에서만 부른다. 개인을 알아볼 수 있는 값(이메일·이름)은 담지 않는다.
drop function if exists public.admin_stats(int);

create or replace function public.admin_stats(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with
  b as (
    select (now() at time zone 'Asia/Seoul')::date as today,
           p_from::timestamp at time zone 'Asia/Seoul' as t_from,
           (p_to + 1)::timestamp at time zone 'Asia/Seoul' as t_to,
           (date_trunc('month', now() at time zone 'Asia/Seoul'))::timestamp at time zone 'Asia/Seoul' as month_start
  ),
  days as (
    select g::date as d from generate_series(p_from, p_to, interval '1 day') g
  ),
  acts as (
    -- 활동 = 기간 안에 읽거나 들은 기록(둘 중 늦은 쪽이 아니라 각각을 하나의 활동으로 본다)
    select user_id, read_at as at from public.reads, b where read_at >= b.t_from and read_at < b.t_to
    union all
    select user_id, listened_at from public.reads, b where listened_at >= b.t_from and listened_at < b.t_to
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
    select (at at time zone 'Asia/Seoul')::date as d, count(distinct user_id) n from acts group by 1
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
      'active', (select count(distinct user_id) from acts),
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
        'reads', coalesce(r.n, 0),
        'listens', coalesce(l.n, 0)
      ) order by days.d), '[]')
      from days
      left join signups s on s.d = days.d
      left join active_d a on a.d = days.d
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
