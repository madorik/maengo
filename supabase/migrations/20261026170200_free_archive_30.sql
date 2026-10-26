-- Free 보관함을 최근 3개월(90일) → 1개월(30일)로(2026-10-26 사용자 결정, Premium 6개월과 같은 날).
-- 피드 기록은 지우지 않고 보관함에서 기간으로만 거른다: 31~180일 기록은 남아 Premium으로 올리면 6개월이 바로 보인다(지우는 건 prune_archive, 180일)
update public.plans set archive_days = 30, updated_at = now() where id = 'free';
