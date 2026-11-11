-- 오늘의 흐름(2026-11-11): 브리핑(출근길·퇴근길)마다 받은 소식을 엮은 한 장(흐름 2~3개·확인할 것). apps/web/lib/server/briefing-insight.ts
-- 처음 열 때 한 번 만들고 그대로 쓴다. 소식 목록(ids)이 바뀌면 다시 만든다. Free·Premium 모두
create table if not exists public.briefing_insights (
  user_id    uuid not null references public.profiles on delete cascade,
  date       date not null,                                   -- 한국 날짜
  slot       text not null check (slot in ('am', 'pm')),
  ids        text not null,                                   -- 만들 때의 소식 번호(차례대로, 쉼표)
  data       jsonb not null,                                  -- {headline, flows:[{title,text,ids}], checks:[{text,id}]}
  created_at timestamptz not null default now(),
  primary key (user_id, date, slot)
);
alter table public.briefing_insights enable row level security;
