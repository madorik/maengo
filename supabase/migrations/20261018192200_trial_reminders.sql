-- 무료 체험 끝 알림(2026-10-18). 체험이 내일(KST) 끝나 첫 결제가 되는 사람(subscriptions.status = 'trial', 해지 안 함)에게
-- FCM 푸시를 한 번 보낸다(pipeline/src/trial-reminder.ts). 서버 스케줄러 작업 trial_reminder: 하루 한 번 12:00 KST.
-- 체험은 계정당 한 번이라 사람마다 한 줄. 보내기 전에 먼저 넣은 쪽만 보내서 두 번 돌아도 한 번만 간다. 서버 키로만 읽고 쓴다(정책 없음).
-- 코드를 먼저 배포하고 적용한다(예전 스케줄러는 모르는 작업이라 실패로 기록하고 하루 미룬다).
create table if not exists public.trial_reminders (
  user_id   uuid primary key references public.profiles on delete cascade,
  trial_end timestamptz not null,           -- 알린 체험의 끝(subscriptions.current_period_end)
  sent_at   timestamptz not null default now(),
  result    text                            -- sent | muted | no_device: … | retry: … | error: …
);
alter table public.trial_reminders enable row level security;

-- 첫 차례는 다음 12:00 KST. 그 뒤로는 finish_scheduler_task가 이 시각에 맞춰 하루씩 민다
insert into public.scheduler_tasks (name, every_minutes, config, next_run_at)
values ('trial_reminder', 1440, '{}',
        (date_trunc('day', (now() at time zone 'Asia/Seoul') - interval '12 hours') + interval '1 day 12 hours') at time zone 'Asia/Seoul')
on conflict (name) do nothing;
