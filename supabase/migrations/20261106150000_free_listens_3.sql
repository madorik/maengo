-- Free 음성 듣기를 하루 1개에서 3개로(2026-11-06 사용자 결정: 1개는 너무 적다).
-- '이 글 듣기'만 세고, 전체 듣기·플레이리스트는 그대로 Premium. 요금표·소개·FAQ는 이 값을 읽는다(서버 1분 캐시)
update public.plans set daily_listens = 3, updated_at = now() where id = 'free';
