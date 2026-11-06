-- Free 하루 소식을 3개에서 5개로 늘린다(2026-11-06 사용자 결정: "프리 3개 너무 적다"). Premium 10개는 그대로
update public.plans set daily_items = 5, updated_at = now() where id = 'free';
