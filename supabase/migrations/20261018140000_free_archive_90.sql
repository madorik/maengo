-- Free 보관함을 최근 7일 → 3개월(90일)로(2026-10-18 사용자 결정). 피드 기록은 원래 지우지 않고 보관함에서 기간으로만 거르므로
-- 바꾸면 지난 90일 소식이 바로 보이고 저장 공간은 늘지 않는다
update public.plans set archive_days = 90, updated_at = now() where id = 'free';
