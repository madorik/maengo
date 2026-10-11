-- 관리자 통계(2026-10-11, /admin). 한 번 불러 화면에 필요한 숫자를 모두 돌려준다. 날짜는 한국 시간 기준.
-- 서버(service role)에서만 부른다. 개인을 알아볼 수 있는 값(이메일·이름)은 담지 않는다.
create or replace function public.admin_stats(p_days int default 14) returns jsonb
language sql stable security definer set search_path = '' as $$
  with
  b as (
    select (now() at time zone 'Asia/Seoul')::date as today,
           ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul' as today_start,
           (date_trunc('month', now() at time zone 'Asia/Seoul'))::timestamp at time zone 'Asia/Seoul' as month_start
  ),
  days as (
    select (b.today - g)::date as d from b, generate_series(0, p_days - 1) g
  ),
  acts as (
    -- 활동 = 읽거나 들은 기록(둘 중 늦은 쪽이 아니라 각각을 하나의 활동으로 본다)
    select user_id, read_at as at from public.reads where read_at is not null
    union all
    select user_id, listened_at from public.reads where listened_at is not null
  )
  select jsonb_build_object(
    'today', (select today from b),
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'onboarded', (select count(*) from public.profiles where onboarded_at is not null),
      'today', (select count(*) from public.profiles, b where created_at >= b.today_start),
      'pushOn', (select count(*) from public.profiles where push_enabled),
      'plans', (select coalesce(jsonb_object_agg(plan, n), '{}') from (select plan, count(*) n from public.profiles group by plan) x)
    ),
    'activity', jsonb_build_object(
      'dau', (select count(distinct user_id) from acts, b where at >= b.today_start),
      'wau', (select count(distinct user_id) from acts, b where at >= b.today_start - interval '6 days'),
      'readsToday', (select count(*) from public.reads, b where read_at >= b.today_start),
      'listensToday', (select count(*) from public.reads, b where listened_at >= b.today_start),
      'feedToday', (select count(*) from public.feed_days, b where date = b.today),
      'feedback', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from public.feedback group by kind) x),
      'feedback7d', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from public.feedback, b where created_at >= b.today_start - interval '6 days' group by kind) x)
    ),
    'daily', (
      select jsonb_agg(jsonb_build_object(
        'date', d,
        'signups', (select count(*) from public.profiles where (created_at at time zone 'Asia/Seoul')::date = d),
        'active', (select count(distinct user_id) from acts where (at at time zone 'Asia/Seoul')::date = d),
        'reads', (select count(*) from public.reads where (read_at at time zone 'Asia/Seoul')::date = d),
        'listens', (select count(*) from public.reads where (listened_at at time zone 'Asia/Seoul')::date = d)
      ) order by d)
      from days
    ),
    'content', jsonb_build_object(
      'itemsToday', (select count(*) from public.items, b where fetched_at >= b.today_start),
      'summariesToday', (select count(*) from public.summaries, b where created_at >= b.today_start),
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
      'geminiTodayUsd', (select coalesce(sum(est_usd), 0) from public.usage_log, b where provider = 'gemini' and at >= b.today_start),
      'geminiMonthUsd', (select coalesce(sum(est_usd), 0) from public.usage_log, b where provider = 'gemini' and at >= b.month_start),
      'ttsMonthChars', (select coalesce(sum(units), 0) from public.usage_log, b where provider = 'google' and kind = 'tts' and at >= b.month_start),
      'ttsMonthUsd', (select coalesce(sum(est_usd), 0) from public.usage_log, b where provider = 'google' and kind = 'tts' and at >= b.month_start),
      'voicesMonth', (select count(*) from public.usage_log, b where provider = 'maengo' and kind = 'voice' and at >= b.month_start)
    ),
    'ops', jsonb_build_object(
      'tasks', (
        select coalesce(jsonb_agg(jsonb_build_object('name', name, 'enabled', enabled, 'everyMinutes', every_minutes, 'nextRunAt', next_run_at,
          'runningSince', running_since, 'lastFinishedAt', last_finished_at, 'lastStatus', last_status, 'lastError', left(last_error, 200)) order by name), '[]')
        from public.scheduler_tasks
      ),
      'deliveriesToday', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.delivery_jobs, b where date = b.today group by status) x),
      'devices', (select coalesce(jsonb_object_agg(platform, n), '{}') from (select platform, count(*) n from public.device_tokens group by platform) x)
    )
  );
$$;

revoke all on function public.admin_stats(int) from public, anon, authenticated;
grant execute on function public.admin_stats(int) to service_role;
