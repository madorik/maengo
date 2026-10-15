-- 플레이리스트(2026-10-15 사용자 결정: 메뉴로 따로, 담아 둔 소식을 관리하고 이어 듣기. Premium).
-- 보관함 '골라 듣기'에서 담고, /playlist에서 순서 바꾸기·빼기·비우기·전체 듣기. 한 사람에 PLAYLIST_MAX(20)개까지(apps/web/lib/playlist.ts).
-- 서버 키로만 읽고 쓴다(정책 없음). 여러 번 돌려도 같은 결과가 나오게 쓴다.
create table if not exists public.playlist_items (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  cluster_id bigint not null references public.clusters (id) on delete cascade,
  position   int not null,
  added_at   timestamptz not null default now(),
  primary key (user_id, cluster_id)
);
create index if not exists playlist_items_user_position on public.playlist_items (user_id, position);
alter table public.playlist_items enable row level security;
