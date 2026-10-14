-- 플랜별 값(2026-10-14 사용자 결정: 코드 상수 대신 표로 두고 배포 없이 바꾼다).
-- 웹·파이프라인이 1분 캐시로 읽는다(apps/web/lib/server/plans.ts, pipeline/src/lib/plans.ts). 값을 바꾸면 1분 안에 반영된다.
-- 맹고 = 하루에 받는 소식 수(daily_items). 더 받기는 지갑(가입 선물·추가 구매한 맹고)에서 1맹고씩 쓴다.
-- 표는 서버 키로만 읽고 쓴다(정책 없음). Supabase 대시보드의 표 편집기로 고친다.
create table public.plans (
  id             text primary key,                 -- profiles.plan과 같은 값(free, plus)
  name           text not null,                    -- 화면에 보이는 이름
  price_krw      int  not null default 0 check (price_krw >= 0),  -- 보여 주는 월 가격(실제 결제 금액은 스토어에 정한 값)
  daily_items    int  not null check (daily_items between 1 and 10), -- 하루 맹고(하루에 받는 소식 수). 피드는 하루 10개까지 골라 둔다
  audio          boolean not null,                 -- 음성 듣기
  topic_limit    int  not null check (topic_limit >= 0),   -- 목록에서 고르는 관심사 수
  custom_limit   int  not null check (custom_limit >= 0),  -- 기타(목록에 없는 걸 직접 적는) 관심사 수
  can_buy_maengo boolean not null,                 -- 맹고 추가 구매
  archive_days   int  check (archive_days is null or archive_days > 0), -- 보관함에서 볼 수 있는 날 수(null = 전체)
  updated_at     timestamptz not null default now()
);
alter table public.plans enable row level security;

insert into public.plans (id, name, price_krw, daily_items, audio, topic_limit, custom_limit, can_buy_maengo, archive_days) values
  ('free', 'Free', 0, 3, false, 5, 0, false, 7),
  ('plus', 'Premium', 5900, 10, true, 20, 10, true, null);

-- 회원 플랜은 이 표의 id만(예전 'trial'은 안 쓴다)
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles alter column plan set default 'free';
alter table public.profiles add constraint profiles_plan_fkey foreign key (plan) references public.plans (id);
