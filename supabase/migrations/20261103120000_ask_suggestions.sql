-- 맹고 AI 추천 질문(2026-11-03 사용자: 처음 보이는 질문 칩을 그 소식에 맞는 질문으로).
-- 소식(묶음)마다 Gemini로 한 번 만들어 모두가 같이 쓴다(apps/web/lib/server/ask-suggest.ts). 묶음이 지워지면 같이 지운다.
-- 서버 키로만 읽고 쓴다(정책 없음). 여러 번 돌려도 같은 결과가 나오게 쓴다.
create table if not exists public.ask_suggestions (
  cluster_id bigint primary key references public.clusters (id) on delete cascade,
  questions  jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ask_suggestions enable row level security;
