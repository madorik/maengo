-- 주간 리포트(2026-11-10, Premium. 월간은 뺐다). 받은 소식을 한 주(KST 월~일)로 모아 숫자·분야별 정리·떠오른 키워드·새로 넣은 관심사를 보여 준다.
-- 만드는 쪽: 서버 스케줄러 작업 reports(하루 한 번 08:00 KST, pipeline/src/reports.ts). 지난주 리포트가 없는
-- Premium 회원 것을 만들고 푸시를 한 번 보낸다. 리포트 화면에서 Premium이 '지금 만들기'를 눌러도 같은 함수로 만든다(apps/web/app/api/report).
-- 사람·기간마다 한 줄. 서버 키로만 읽고 쓴다(정책 없음). 자세한 규칙은 맹고-문서/리포트.md.
-- 코드를 먼저 배포하고 적용한다(예전 스케줄러는 모르는 작업이라 실패로 기록하고 하루 미룬다).

-- 관심사를 넣은 시각('새로 넣은 관심사'). 이 칸이 생기기 전에 넣은 관심사는 null(새로 넣은 것으로 치지 않는다)
alter table public.user_topics add column if not exists created_at timestamptz;
alter table public.user_topics alter column created_at set default now();

create table if not exists public.reports (
  user_id     uuid not null references public.profiles on delete cascade,
  period      text not null check (period in ('week')),
  start_date  date not null,                 -- 기간 첫날(KST 월요일)
  end_date    date not null,                 -- 기간 마지막 날(포함)
  status      text not null check (status in ('ready', 'empty')),  -- empty: 받은 소식이 너무 적어 만들지 않음(다시 시도하지 않는다)
  data        jsonb not null default '{}',   -- 숫자·분야·AI 정리(pipeline/src/reports.ts ReportData)
  created_at  timestamptz not null default now(),
  seen_at     timestamptz,                   -- 리포트 화면에서 처음 연 시각(오늘 화면 안내 카드를 거둔다)
  push_result text,                          -- 알림 결과(sent | muted | no_device: … | error: …). 화면에서 만든 리포트는 null
  primary key (user_id, period, start_date)
);
alter table public.reports enable row level security;

-- 첫 차례는 다음 08:00 KST. 그 뒤로는 finish_scheduler_task가 이 시각에 맞춰 하루씩 민다
insert into public.scheduler_tasks (name, every_minutes, config, next_run_at)
values ('reports', 1440, '{}',
        (date_trunc('day', (now() at time zone 'Asia/Seoul') - interval '8 hours') + interval '1 day 8 hours') at time zone 'Asia/Seoul')
on conflict (name) do nothing;
