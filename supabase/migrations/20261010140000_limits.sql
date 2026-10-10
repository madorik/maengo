-- 사용자별 한도와 음성 중복 생성 막기
-- 음성 만들기 잠금: 여러 서버(Vercel 함수)가 같은 음성을 동시에 만들지 않게 한다. 오래된 잠금(3분)은 넘겨받는다
create table public.audio_jobs (
  key         text primary key,
  started_at  timestamptz not null default now()
);
alter table public.audio_jobs enable row level security;

-- 서비스 상태. 'tts_quota': Gemini TTS 하루 한도가 찼을 때 그 시각까지 TTS를 부르지 않는다
create table public.service_flags (
  key    text primary key,
  until  timestamptz,
  note   text
);
alter table public.service_flags enable row level security;

-- 사용자별 오늘 사용량(새 음성 만들기, 직접 입력해 더하기)을 usage_log로 센다
create index usage_log_user_kind_at_idx on public.usage_log (user_id, kind, at);
