-- 맹고 초기 스키마(PLAN.md 4장). 직업은 받지 않는다. 푸시는 FCM 기기 토큰으로 보낸다.
create extension if not exists vector with schema extensions;

-- 사용자 ------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users on delete cascade,
  display_name   text,
  notify_at      time not null default '07:00',
  plan           text not null default 'trial' check (plan in ('free','trial','plus')),
  trial_ends_at  timestamptz,
  persona        text not null default 'teacher' check (persona in ('announcer','teacher','dialogue')),
  voice          text not null default 'f' check (voice in ('f','m')),
  auto_next      boolean not null default true,
  skip_read      boolean not null default false,
  podcast_token  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  onboarded_at   timestamptz,                    -- 관심사 온보딩을 마친 시각. null이면 /onboarding으로
  created_at     timestamptz not null default now()
);

-- 가입하면 프로필을 만든다(플러스 체험 7일). 이름은 애플·구글이 처음 한 번만 준다.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, trial_ends_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), now() + interval '7 days');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 토픽 --------------------------------------------------------------
create table public.topics (
  id          text primary key,                 -- 'rag', 'llm-agent'
  name        text not null,                    -- 'RAG'
  aliases     text[] not null default '{}',
  popularity  int  not null default 0,          -- 추천 순서(작을수록 앞)
  embedding   extensions.vector(768)
);
create table public.user_topics (
  user_id   uuid not null references public.profiles on delete cascade,
  topic_id  text not null references public.topics,
  weight    real not null default 1.0,
  source    text not null default 'onboarding' check (source in ('onboarding','text','settings','feedback')),
  primary key (user_id, topic_id)
);
-- 사전에 없던 관심사(토픽 사전을 늘릴 근거)
create table public.unmatched_interests (
  id       bigserial primary key,
  user_id  uuid references public.profiles on delete set null,
  text     text not null,
  at       timestamptz not null default now()
);

-- 수집 --------------------------------------------------------------
create table public.sources (
  id          serial primary key,
  kind        text not null check (kind in ('rss','youtube','hn','devto','search')),
  url         text not null unique,
  name        text not null,
  weight      real not null default 1.0,
  active      boolean not null default true,
  last_ok_at  timestamptz,
  fail_count  int not null default 0
);
create table public.clusters (
  id             bigserial primary key,
  first_seen_at  timestamptz not null default now(),
  size           int  not null default 1,
  score          real not null default 0,
  is_video       boolean not null default false
);
create table public.items (
  id             bigserial primary key,
  source_id      int references public.sources,
  canonical_url  text not null unique,
  title          text not null,
  kind           text not null check (kind in ('article','video')),
  author         text,
  published_at   timestamptz,
  fetched_at     timestamptz not null default now(),
  embedding      extensions.vector(768),
  cluster_id     bigint references public.clusters
);
create index items_embedding_idx on public.items using hnsw (embedding extensions.vector_cosine_ops);
create index items_fetched_idx   on public.items (fetched_at);
create index items_cluster_idx   on public.items (cluster_id);
create table public.cluster_topics (
  cluster_id  bigint not null references public.clusters on delete cascade,
  topic_id    text   not null references public.topics,
  relevance   real   not null,
  primary key (cluster_id, topic_id)
);

-- 요약 캐시 ---------------------------------------------------------
create table public.summaries (
  cluster_id    bigint not null references public.clusters on delete cascade,
  tier          text   not null check (tier in ('basic','pro')),  -- basic=무료(Flash), pro=플러스(상위 모델)
  title         text not null,
  short         text not null,                  -- 목록에 보이는 요약
  body          jsonb not null,                 -- 전체 글(문단 배열). 원문을 옮기지 않고 다시 쓴 글
  author        text,
  category      text not null default 'etc' check (category in ('ai','tech','design','business','marketing','career','finance','science','travel','life','etc')),
  published_at  timestamptz,
  evidence      text,
  scenes        jsonb,                          -- 유튜브: [{"t":"4:10","label":"…"}]
  model         text not null,
  version       int  not null default 1,
  created_at    timestamptz not null default now(),
  primary key (cluster_id, tier)
);
create table public.cluster_why (
  cluster_id  bigint not null references public.clusters on delete cascade,
  topic_id    text   not null references public.topics,
  tier        text   not null check (tier in ('basic','pro')),
  why         text   not null,                  -- "LLM 에이전트에 관심 있다면: …"
  primary key (cluster_id, topic_id, tier)
);

-- 유저별 결과 -------------------------------------------------------
-- 랭킹은 하루 최대 10개까지 저장하고, 그날 보여 준 개수는 feed_days.visible에 둔다(무료 1, 플러스 10)
create table public.feeds (
  user_id     uuid   not null references public.profiles on delete cascade,
  date        date   not null,
  rank        int    not null check (rank between 1 and 10),
  cluster_id  bigint not null references public.clusters,
  topic_id    text   not null references public.topics, -- why 문구를 고를 토픽
  primary key (user_id, date, rank)
);
create table public.feed_days (
  user_id  uuid not null references public.profiles on delete cascade,
  date     date not null,
  visible  int  not null check (visible between 0 and 10),
  primary key (user_id, date)
);
create table public.feedback (
  user_id     uuid   not null references public.profiles on delete cascade,
  cluster_id  bigint not null references public.clusters on delete cascade,
  kind        text   not null check (kind in ('more','known','skip')),
  topic_id    text   references public.topics,  -- 가중치를 바꾼 토픽
  delta       real   not null default 0,        -- 바꾼 양(피드백을 바꾸면 되돌린다)
  created_at  timestamptz not null default now(),
  primary key (user_id, cluster_id)
);
create table public.reads (
  user_id      uuid   not null references public.profiles on delete cascade,
  cluster_id   bigint not null references public.clusters on delete cascade,
  read_at      timestamptz,
  listened_at  timestamptz,
  starred      boolean not null default false,
  primary key (user_id, cluster_id)
);

-- 오디오·스터디 팩 --------------------------------------------------
create table public.audio_segments (
  cluster_id      bigint not null references public.clusters on delete cascade,
  persona         text   not null,
  voice           text   not null,              -- f | m | pair(대담)
  script_version  int    not null,
  script          jsonb  not null,              -- [{who?, text, para?}]
  r2_key          text   not null,
  duration_ms     int    not null,
  primary key (cluster_id, persona, voice, script_version)
);
create table public.episodes (
  user_id      uuid   not null references public.profiles on delete cascade,
  date         date   not null,
  persona      text   not null,
  voice        text   not null,
  r2_key       text   not null,
  bytes        bigint not null,
  duration_ms  int    not null,
  chapters     jsonb  not null,                 -- [{rank, clusterId, startMs, endMs, title, lines}]
  primary key (user_id, date, persona, voice)
);
create table public.packs (
  user_id     uuid not null references public.profiles on delete cascade,
  week_start  date not null,
  pptx_key    text,
  pdf_key     text,
  primary key (user_id, week_start)
);

-- 알림 --------------------------------------------------------------
-- FCM 등록 토큰. Android·iOS 앱과 웹(PWA)이 모두 FCM으로 받는다
create table public.device_tokens (
  token         text primary key,
  user_id       uuid not null references public.profiles on delete cascade,
  platform      text not null check (platform in ('android','ios','web')),
  app_version   text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index device_tokens_user_idx on public.device_tokens (user_id);
create table public.notifications_log (
  user_id  uuid not null references public.profiles on delete cascade,
  date     date not null,
  channel  text not null check (channel in ('push','email')),
  sent_at  timestamptz not null default now(),
  primary key (user_id, date, channel)
);

-- 결제·운영 ---------------------------------------------------------
-- 웹은 포트원, 앱은 앱스토어·플레이 결제(스토어 정책). 어디서 샀는지 store에 둔다
create table public.subscriptions (
  user_id               uuid primary key references public.profiles on delete cascade,
  store                 text not null check (store in ('portone','app_store','play')),
  billing_key           text,                   -- 포트원 빌링키
  store_ref             text,                   -- 앱스토어 originalTransactionId / 플레이 purchaseToken
  status                text not null check (status in ('active','past_due','canceled')),
  current_period_end    timestamptz not null,
  cancel_at_period_end  boolean not null default false,
  retry_count           int not null default 0
);
create table public.payments (
  id        text primary key,                   -- 우리가 만든 paymentId = 멱등 키
  user_id   uuid not null references public.profiles on delete cascade,
  store     text not null,
  amount    int  not null,
  status    text not null,
  paid_at   timestamptz,
  raw       jsonb
);
create table public.usage_log (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  provider  text not null,                      -- gemini | search
  kind      text not null,                      -- summary | why | script | tts | embed | video | topic_map | classify
  user_id   uuid references public.profiles on delete set null,
  units     bigint not null,                    -- 토큰 수 또는 오디오 초
  est_usd   numeric(10,4) not null
);

-- RLS(PLAN.md 4장 표) ----------------------------------------------
alter table public.profiles           enable row level security;
alter table public.topics             enable row level security;
alter table public.user_topics        enable row level security;
alter table public.unmatched_interests enable row level security;
alter table public.sources            enable row level security;
alter table public.clusters           enable row level security;
alter table public.items              enable row level security;
alter table public.cluster_topics     enable row level security;
alter table public.summaries          enable row level security;
alter table public.cluster_why        enable row level security;
alter table public.feeds              enable row level security;
alter table public.feed_days          enable row level security;
alter table public.feedback           enable row level security;
alter table public.reads              enable row level security;
alter table public.audio_segments     enable row level security;
alter table public.episodes           enable row level security;
alter table public.packs              enable row level security;
alter table public.device_tokens      enable row level security;
alter table public.notifications_log  enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.payments           enable row level security;
alter table public.usage_log          enable row level security;

-- 프로필: 본인 것만 보고, 고칠 수 있는 칸은 설정값뿐(플랜·체험 기간은 서버만 바꾼다)
create policy "본인 프로필 보기" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "본인 프로필 고치기" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke update on public.profiles from authenticated, anon;
grant update (display_name, notify_at, persona, voice, auto_next, skip_read) on public.profiles to authenticated;

-- 본인 행만 읽고 쓰는 표
create policy "본인 토픽" on public.user_topics for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "본인 피드백" on public.feedback for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "본인 읽음" on public.reads for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "본인 기기" on public.device_tokens for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- 본인 행만 읽는 표(쓰기는 파이프라인·서버)
create policy "본인 피드" on public.feeds for select to authenticated using ((select auth.uid()) = user_id);
create policy "본인 피드 날짜" on public.feed_days for select to authenticated using ((select auth.uid()) = user_id);
create policy "본인 에피소드" on public.episodes for select to authenticated using ((select auth.uid()) = user_id);
create policy "본인 스터디 팩" on public.packs for select to authenticated using ((select auth.uid()) = user_id);

-- 로그인한 사람은 모두 읽는 표(소식·토픽)
create policy "토픽 읽기" on public.topics for select to authenticated using (true);
create policy "클러스터 읽기" on public.clusters for select to authenticated using (true);
create policy "아이템 읽기" on public.items for select to authenticated using (true);
create policy "클러스터 토픽 읽기" on public.cluster_topics for select to authenticated using (true);
create policy "요약 읽기" on public.summaries for select to authenticated using (true);
create policy "why 읽기" on public.cluster_why for select to authenticated using (true);

-- sources, unmatched_interests, audio_segments, notifications_log, subscriptions, payments, usage_log:
-- 정책 없음 = 클라이언트 접근 불가, service role(서버·파이프라인)만 쓴다
