-- 일일 파이프라인(PLAN.md 6장)에 필요한 칸. 수집은 제목·RSS 설명으로 임베딩하고, 본문은 요약할 때만 읽는다.

-- 아이템: RSS 설명(임베딩 입력, 앞 600자만). 기사 본문은 저장하지 않는다
alter table public.items add column excerpt text;
create index items_published_idx on public.items (published_at);

-- 클러스터: 대표 아이템, 중심 벡터(태그·비슷한 소식 제외용), 마지막으로 새 아이템이 붙은 시각
alter table public.clusters add column rep_item_id  bigint references public.items on delete set null;
alter table public.clusters add column centroid     extensions.vector(768);
alter table public.clusters add column last_seen_at timestamptz not null default now();
alter table public.clusters add column tagged_at    timestamptz;
-- 요약 단계가 소식이 아니라고 본 클러스터(광고·채용 공고·본문 없음). 다시 요약하지 않는다
alter table public.clusters add column skip_reason  text;
create index clusters_first_seen_idx on public.clusters (first_seen_at);

-- 출처: 언어와 수집 실패 메모
alter table public.sources add column lang       text not null default 'en' check (lang in ('ko','en'));
alter table public.sources add column last_error text;

-- 실행 기록(report 단계). 단계별 건수·실패·소요 시간
create table public.pipeline_runs (
  id           bigserial primary key,
  date         date not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean,
  stats        jsonb not null default '{}',
  error        text
);
alter table public.pipeline_runs enable row level security;
-- 정책 없음 = service role만 쓴다

create index feeds_cluster_idx on public.feeds (cluster_id);
create index usage_log_at_idx  on public.usage_log (at);
