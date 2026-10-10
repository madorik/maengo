-- 듣기 음성은 대본 내용 해시(key)로 저장한다. 같은 소식이라도 토픽(why 문구)·말투·목소리가 다르면 다른 음성이다.
-- 파일은 R2(audio/seg/<key>.mp3). 오늘 전체 듣기 파일은 세그먼트를 이어 붙여 audio/ep/<hash>.mp3로 둔다(행은 만들지 않음).
-- 사용자가 재생을 누를 때 만든다(배치에서 미리 만들지 않음). 아직 빈 표라 다시 만든다.
drop table public.audio_segments;
create table public.audio_segments (
  key          text primary key,                -- 'teacher-m-<hash>'
  cluster_id   bigint not null references public.clusters on delete cascade,
  persona      text not null check (persona in ('announcer','teacher','dialogue')),
  voice        text not null check (voice in ('f','m','pair')),
  model        text not null,
  r2_key       text not null,                   -- audio/seg/<key>.mp3
  bytes        int  not null,
  duration_ms  int  not null,
  lines        jsonb not null,                  -- [{who?, text, para?, startMs, endMs}]
  created_at   timestamptz not null default now()
);
create index audio_segments_cluster_idx on public.audio_segments (cluster_id);
alter table public.audio_segments enable row level security;
-- 정책 없음 = service role(서버)만 쓴다
