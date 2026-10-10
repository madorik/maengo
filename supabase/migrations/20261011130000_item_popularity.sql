-- 글의 인기 신호. 수집할 때마다 새 값으로 바꾼다(유튜브 조회수는 채널 RSS, 해커 뉴스 점수는 hnrss 설명).
-- 같은 소식 안에서 대표 글을 고르고 소식끼리 순위를 매길 때 출처 가중치와 함께 쓴다(packages/core/src/feed/quality.ts).
-- 더하기만 하는 변경이라 운영 코드보다 먼저 넣어도 된다.
alter table public.items
  add column if not exists views     bigint,
  add column if not exists hn_points int;

comment on column public.items.views is '유튜브 조회수(마지막 수집 때)';
comment on column public.items.hn_points is '해커 뉴스 점수(마지막 수집 때)';
