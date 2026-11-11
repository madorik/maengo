-- 내 맞춤 정보(2026-11-11 사용자: 주식 소식이면 '주식 하세요?'를 한 번씩 묻고 국장·미장도 골라, 받은 소식의 인사이트를 그 사람 사정에 맞춰 준다).
-- 질문 목록은 apps/web/lib/context.ts. value가 'skip'이면 '나중에'(updated_at부터 7일 동안 다시 묻지 않는다). 회원이 '내 관심 키워드' 화면에서 바꾸거나 지운다
create table if not exists public.user_context (
  user_id    uuid not null references public.profiles on delete cascade,
  key        text not null,
  value      text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_context enable row level security;
