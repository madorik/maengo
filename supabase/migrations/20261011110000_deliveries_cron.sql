-- 서버 스케줄러: 5분마다 웹 /api/cron/deliveries를 부른다(delivery_jobs 표대로 알림 시각에 맹고를 만들고 보낸다).
-- 호출 비밀값은 저장소에 두지 않고 Supabase Vault에 둔다(set_cron_secret, 서버 키로만 부를 수 있다).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.set_cron_secret(p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'cron_secret';
  if v_id is null then
    perform vault.create_secret(p_secret, 'cron_secret', 'maengo /api/cron/deliveries 호출용');
  else
    perform vault.update_secret(v_id, p_secret);
  end if;
end;
$$;
revoke all on function public.set_cron_secret(text) from public, anon, authenticated;
grant execute on function public.set_cron_secret(text) to service_role;

select cron.schedule(
  'maengo-deliveries',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://maengo.vercel.app/api/cron/deliveries',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $cron$
);

-- 스케줄러가 잘 도는지 보는 곳(서버 키로만): 최근 실행과 서버 응답 코드
create or replace function public.cron_status(p_limit int default 5)
returns table (started_at timestamptz, run_status text, message text, http_status int, http_at timestamptz)
language sql security definer set search_path = '' as $$
  with runs as (
    select d.start_time, d.status, d.return_message, row_number() over (order by d.start_time desc) as n
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    where j.jobname = 'maengo-deliveries'
    order by d.start_time desc limit p_limit
  ), http as (
    select r.status_code, r.created, row_number() over (order by r.created desc) as n
    from net._http_response r order by r.created desc limit p_limit
  )
  select runs.start_time, runs.status, left(runs.return_message, 200), http.status_code, http.created
  from runs left join http on http.n = runs.n
  order by runs.start_time desc;
$$;
revoke all on function public.cron_status(int) from public, anon, authenticated;
grant execute on function public.cron_status(int) to service_role;
